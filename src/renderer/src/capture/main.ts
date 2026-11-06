/**
 * Hidden capture window.
 *
 * Streams the game window (Windows Graphics Capture under the hood, so the overlay on top of it
 * is never in the picture) at a few frames per second. For every frame it crops only the
 * calibrated regions, builds a 1-bit text mask, and sends a region to OCR only when that mask
 * changed. Idle cost is a handful of tiny canvas reads per frame; OCR runs only when the numbers
 * actually change (e.g. when you kill a mob).
 */
import type { CaptureStatus, RegionKey, Settings, WindowSourceInfo } from '@shared/types'
import { REGION_KEYS } from '@shared/types'
import { maskCount, maskDiff, maskGained, renderForOcr, textMask } from './pixels'

const api = window.api

/** Minimum gap between two OCR passes of the same region. */
const MIN_INTERVAL: Record<RegionKey, number> = { level: 800, name: 1500, exp: 200, notices: 600 }
/** Re-read regions now and then even if nothing changed, to self-heal from a bad read. */
const FORCE_INTERVAL_MS = 20_000

interface RegionState {
  raw: OffscreenCanvas
  big: OffscreenCanvas
  mask?: Uint8Array
  lastOcr: number
  busy: boolean
  retry: boolean
}

const regions = new Map<RegionKey, RegionState>(
  REGION_KEYS.map((k) => [
    k,
    { raw: new OffscreenCanvas(1, 1), big: new OffscreenCanvas(1, 1), lastOcr: 0, busy: false, retry: false }
  ])
)

const atlas = new OffscreenCanvas(1, 1)
let settings: Settings
let stream: MediaStream | null = null
let generation = 0
let currentSource: WindowSourceInfo | null = null
let wantSnapshot = false
let lastFrameAt = 0
let frameSize = { w: 0, h: 0 }

function status(s: CaptureStatus): void {
  api.captureStatus({ windowName: currentSource?.name, ...s })
}

function resetRegions(): void {
  for (const r of regions.values()) {
    r.mask = undefined
    r.retry = false
  }
}

function stop(): void {
  generation++
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
}

async function start(src: WindowSourceInfo | null): Promise<void> {
  stop()
  currentSource = src
  resetRegions()
  if (!src) return
  const gen = generation
  status({ state: 'starting' })
  try {
    const media = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: src.id,
          maxFrameRate: settings.captureFps,
          // Game UIs are low-res and upscaled; beyond 1440p we only pay for memory, not detail.
          maxWidth: 2560,
          maxHeight: 1440
        }
      }
    } as unknown as MediaStreamConstraints)
    if (gen !== generation) {
      media.getTracks().forEach((t) => t.stop())
      return
    }
    stream = media
    const track = media.getVideoTracks()[0]
    track.addEventListener('ended', () => {
      if (gen !== generation) return
      stop()
      status({ state: 'idle', message: 'The game window was closed.' })
    })
    void pump(new MediaStreamTrackProcessor({ track, maxBufferSize: 1 }).readable.getReader(), gen)
  } catch (err) {
    status({ state: 'error', message: `Could not capture the game window: ${String(err)}` })
  }
}

async function pump(reader: ReadableStreamDefaultReader<VideoFrame>, gen: number): Promise<void> {
  try {
    while (gen === generation) {
      const { value: frame, done } = await reader.read()
      if (done || !frame) break
      const t0 = performance.now()
      try {
        if (onFrame(frame)) stats.processed++
      } finally {
        frame.close()
      }
      stats.frames++
      stats.ms += performance.now() - t0
      stats.format = frame.format ?? '?'
      if (t0 - stats.since > 10_000) {
        console.log(
          `[capture] ${frameSize.w}x${frameSize.h} ${stats.format}: ${stats.frames} frames in, ${stats.processed} processed, ${(stats.ms / Math.max(1, stats.frames)).toFixed(2)}ms avg`
        )
        stats = { frames: 0, processed: 0, ms: 0, since: t0, format: stats.format }
      }
    }
  } catch (err) {
    if (gen === generation) status({ state: 'error', message: String(err) })
  } finally {
    reader.releaseLock()
  }
}

let stats = { frames: 0, processed: 0, ms: 0, since: performance.now(), format: '' }

/** Returns true if the frame was examined (not skipped by the frame budget). */
function onFrame(frame: VideoFrame): boolean {
  const now = performance.now()
  // Chromium may deliver faster than asked; enforce the budget ourselves.
  if (!wantSnapshot && now - lastFrameAt < 1000 / settings.captureFps - 5) return false
  lastFrameAt = now

  const W = frame.displayWidth
  const H = frame.displayHeight
  if (W !== frameSize.w || H !== frameSize.h) {
    frameSize = { w: W, h: H }
    resetRegions()
    status({ state: 'streaming', frameWidth: W, frameHeight: H })
  }

  if (wantSnapshot) {
    wantSnapshot = false
    const c = new OffscreenCanvas(W, H)
    c.getContext('2d')!.drawImage(frame, 0, 0)
    void c
      .convertToBlob({ type: 'image/jpeg', quality: 0.92 })
      .then((b) => b.arrayBuffer())
      .then((buf) => api.sendSnapshot(buf))
      .catch(() => api.sendSnapshot(null))
  }

  // 1) Copy every active region into one GPU-backed atlas canvas (GPU→GPU, cheap), then read the
  //    atlas back in a single getImageData. Reading the frame per region would pull the whole
  //    (often 4K) frame off the GPU several times per frame.
  const jobs: { key: RegionKey; st: RegionState; sx: number; sy: number; sw: number; sh: number; y: number }[] = []
  let atlasW = 0
  let atlasH = 0
  for (const key of REGION_KEYS) {
    const rect = settings.regions[key]
    if (!rect || (key === 'notices' && !settings.noticesEnabled)) continue
    const st = regions.get(key)!
    if (st.busy) continue
    const sx = Math.max(0, Math.round(rect.x * W))
    const sy = Math.max(0, Math.round(rect.y * H))
    const sw = Math.min(W - sx, Math.round(rect.w * W))
    const sh = Math.min(H - sy, Math.round(rect.h * H))
    if (sw < 3 || sh < 3) continue
    jobs.push({ key, st, sx, sy, sw, sh, y: atlasH })
    atlasW = Math.max(atlasW, sw)
    atlasH += sh
  }
  if (jobs.length === 0) return true

  if (atlas.width !== atlasW || atlas.height !== atlasH) {
    atlas.width = atlasW
    atlas.height = atlasH
  }
  const actx = atlas.getContext('2d', { willReadFrequently: false })!
  for (const j of jobs) actx.drawImage(frame, j.sx, j.sy, j.sw, j.sh, 0, j.y, j.sw, j.sh)
  const pixels = actx.getImageData(0, 0, atlasW, atlasH).data

  // 2) Per region: compare the 1-bit text mask with the last OCR'd one; OCR only on change.
  for (const { key, st, sw, sh, y } of jobs) {
    const threshold = settings.thresholds[key]
    const mask = textMask(key, pixels, threshold, atlasW, y, sw, sh)
    const minPixels = Math.max(2, mask.length * 0.0015)
    let changed: boolean
    if (key === 'notices') {
      // Notices fade out constantly; only new text appearing is interesting. Fading lines just
      // lose pixels, so trigger on pixels that turned *on*, and never OCR an empty box.
      if (maskCount(mask) < minPixels) {
        st.mask = mask
        continue
      }
      changed = !st.mask || maskGained(mask, st.mask) > minPixels * 4
    } else {
      changed = !st.mask || maskDiff(mask, st.mask) > minPixels
    }
    const due = st.retry || now - st.lastOcr > FORCE_INTERVAL_MS
    if (!(changed || due) || now - st.lastOcr < MIN_INTERVAL[key]) continue

    st.mask = mask
    st.retry = false
    st.lastOcr = now
    st.busy = true
    if (st.raw.width !== sw || st.raw.height !== sh) {
      st.raw.width = sw
      st.raw.height = sh
    }
    st.raw.getContext('2d')!.drawImage(atlas, 0, y, sw, sh, 0, 0, sw, sh)
    const gen = generation
    renderForOcr(key, st.raw, threshold, st.big)
      .convertToBlob({ type: 'image/png' })
      .then((b) => b.arrayBuffer())
      .then((png) => submit(key, st, png, gen))
      .catch((err) => {
        st.busy = false
        console.error('OCR request failed', key, err)
      })
  }
  return true
}

/**
 * Send a processed crop to OCR. If the tracker wants a confirming second read, it normally comes
 * from the next frame. Windows only delivers frames when the window repaints, so if none arrives
 * shortly the picture is static (= not mid-animation) and the cached crop is re-submitted.
 */
async function submit(key: RegionKey, st: RegionState, png: ArrayBuffer, gen: number): Promise<void> {
  st.busy = true
  try {
    const res = await api.ocrRegion(key, png.slice(0))
    if (gen !== generation || !res.retry) return
    st.retry = true
    setTimeout(() => {
      if (gen === generation && st.retry && !st.busy) {
        st.retry = false
        st.lastOcr = performance.now()
        void submit(key, st, png, gen)
      }
    }, 600)
  } catch (err) {
    console.error('OCR request failed', key, err)
  } finally {
    st.busy = false
  }
}

async function init(): Promise<void> {
  settings = await api.getSettings()
  api.onSettings((s) => {
    const fpsChanged = s.captureFps !== settings.captureFps
    settings = s
    resetRegions()
    if (fpsChanged && currentSource) void start(currentSource)
  })
  api.onCaptureSource((src) => {
    if (src?.id === currentSource?.id && stream) return
    void start(src)
  })
  api.onSnapshotRequest(() => {
    wantSnapshot = true
  })
  api.captureReady()
}

void init()
