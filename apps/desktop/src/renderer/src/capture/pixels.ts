import type { RegionKey } from '@shared/types'

/**
 * Per-pixel "is this text?" test. MapleStory UI text is bright on a dark bar; the level digits
 * are white on orange tiles (so we also require a high blue channel).
 */
export function isText(key: RegionKey, r: number, g: number, b: number, threshold: number): boolean {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  if (lum < threshold) return false
  if (key === 'level') return Math.min(r, g, b) >= threshold
  return true
}

/**
 * Binary text mask at native resolution — used to detect whether a region actually changed.
 * Reads the w×h block at row `y0` (column 0) of an RGBA buffer that is `stride` pixels wide.
 */
export function textMask(
  key: RegionKey,
  data: Uint8ClampedArray,
  threshold: number,
  stride: number,
  y0: number,
  w: number,
  h: number
): Uint8Array {
  const out = new Uint8Array(w * h)
  let p = 0
  for (let y = 0; y < h; y++) {
    let i = (y0 + y) * stride * 4
    for (let x = 0; x < w; x++, i += 4) {
      out[p++] = isText(key, data[i], data[i + 1], data[i + 2], threshold) ? 1 : 0
    }
  }
  return out
}

export function maskDiff(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY
  let n = 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++
  return n
}

/** Upscale factor that gets glyphs to a size Tesseract likes (~30-40px tall). */
export function upscaleFor(key: RegionKey, height: number): number {
  if (key === 'name') return 3
  if (height <= 20) return 4
  if (height <= 40) return 3
  return 2
}

const PAD = 16

/**
 * A box drawn slightly too big catches the bright edges of the UI panel, which show up as solid
 * lines and wreck Tesseract's layout analysis. No glyph fills ~75% of a row or column, so wipe those.
 */
export function eraseBorders(d: Uint8ClampedArray, w: number, h: number): void {
  const black = (x: number, y: number): boolean => d[(y * w + x) * 4] === 0
  const white = (x: number, y: number): void => {
    const i = (y * w + x) * 4
    d[i] = d[i + 1] = d[i + 2] = 255
  }
  const rows: number[] = []
  for (let y = 0; y < h; y++) {
    let n = 0
    for (let x = 0; x < w; x++) if (black(x, y)) n++
    if (n > w * 0.75) rows.push(y)
  }
  const cols: number[] = []
  for (let x = 0; x < w; x++) {
    let n = 0
    for (let y = 0; y < h; y++) if (black(x, y)) n++
    if (n > h * 0.75) cols.push(x)
  }
  for (const y of rows) for (let x = 0; x < w; x++) white(x, y)
  for (const x of cols) for (let y = 0; y < h; y++) white(x, y)
}

/** Bounding box of the black (text) pixels in an RGBA buffer, or undefined if there are none. */
export function textBounds(
  d: Uint8ClampedArray,
  w: number,
  h: number
): { x: number; y: number; w: number; h: number } | undefined {
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4] !== 0) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  return x1 < 0 ? undefined : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

/**
 * Builds the image Tesseract sees: upscaled crop, thresholded to black text on white,
 * with a white margin (Tesseract misses glyphs touching the border).
 */
export function renderForOcr(
  key: RegionKey,
  source: OffscreenCanvas,
  threshold: number,
  target: OffscreenCanvas
): OffscreenCanvas {
  const scale = upscaleFor(key, source.height)
  const w = source.width * scale
  const h = source.height * scale
  target.width = w + PAD * 2
  target.height = h + PAD * 2
  const ctx = target.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, target.width, target.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, PAD, PAD, w, h)
  const img = ctx.getImageData(PAD, PAD, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const v = isText(key, d[i], d[i + 1], d[i + 2], threshold) ? 0 : 255
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 255
  }
  eraseBorders(d, w, h)
  // A couple of thin digits in a wide, mostly empty box (level "11") read as nothing at all:
  // Tesseract drops them as noise. Cropped tight around the digits they read fine.
  const crop = key === 'level' ? textBounds(d, w, h) : undefined
  if (crop) {
    target.width = crop.w + PAD * 2
    target.height = crop.h + PAD * 2
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, target.width, target.height)
    ctx.putImageData(img, PAD - crop.x, PAD - crop.y, crop.x, crop.y, crop.w, crop.h)
    return target
  }
  ctx.putImageData(img, PAD, PAD)
  return target
}
