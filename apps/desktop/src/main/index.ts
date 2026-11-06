import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SettingsPatch } from '@shared/api'
import { type Bitmap, GlyphMatcher } from '@shared/glyphs'
import { parseExp, parseLevel, parseMesoLine, parseName } from '@shared/parse'
import { ExpTracker } from '@shared/tracker'
import type { CaptureStatus, RegionDebug, RegionKey, TrackerSnapshot, WindowSourceInfo } from '@shared/types'
import { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, Menu, nativeImage, Tray } from 'electron'
import { migrateLegacyUserData } from './migrate'
import { OcrEngine } from './ocr'
import { SettingsStore } from './store'
import { createCaptureWindow, createOverlayWindow, createSettingsWindow, OVERLAY_WIDTH } from './windows'

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

const SHORTCUT_LOCK = 'CommandOrControl+Shift+L'
const SHORTCUT_TOGGLE = 'CommandOrControl+Shift+H'
const SEARCH_INTERVAL_MS = 3000
/** Set OWLTRACK_DEBUG=1 to log every OCR pass to the console. */
const DEBUG = Boolean(process.env.OWLTRACK_DEBUG)

let store: SettingsStore
let overlay: BrowserWindow | null = null
let capture: BrowserWindow | null = null
let settingsWin: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false
let editingOverlay = false

const ocr = new OcrEngine()
const tracker = new ExpTracker()

/** Learned digit templates for the EXP numbers (see shared/glyphs.ts). */
const CROSS_CHECK_EVERY = 100
const glyphFile = (): string => join(app.getPath('userData'), 'glyphs.json')
let glyphs = new GlyphMatcher()
let expReads = 0
let glyphRejects = 0
let glyphSaveTimer: NodeJS.Timeout | undefined

function loadGlyphs(): void {
  try {
    glyphs = new GlyphMatcher(JSON.parse(readFileSync(glyphFile(), 'utf8')))
  } catch {
    glyphs = new GlyphMatcher()
  }
}

function saveGlyphs(): void {
  clearTimeout(glyphSaveTimer)
  glyphSaveTimer = setTimeout(() => {
    try {
      writeFileSync(glyphFile(), JSON.stringify(glyphs.templates))
    } catch (err) {
      console.error('Failed to save glyph templates', err)
    }
  }, 2000)
}
let captureStatus: CaptureStatus = { state: 'idle' }
let source: WindowSourceInfo | null = null
let identity: { name?: string; job?: string; candidate?: string } = {}
let searchTimer: NodeJS.Timeout | undefined

// ---------------------------------------------------------------------------------------------
// Snapshot broadcasting

function snapshot(now = Date.now()): TrackerSnapshot {
  tracker.tick(now)
  const cur = tracker.current
  const s = store.value
  const ratePerHour = tracker.exp.ratePerHour(30 * 60_000, now)
  const remaining = cur?.required === undefined ? undefined : Math.max(0, cur.required - cur.exp)
  return {
    capture: captureStatus,
    calibrated: Boolean(s.regions.exp),
    level: tracker.level,
    name: identity.name ? (s.nameAliases[identity.name] ?? identity.name) : undefined,
    detectedName: identity.name,
    job: identity.job,
    exp: cur?.exp,
    percent: cur?.percent,
    required: cur?.required,
    last5m: tracker.exp.gainSince(now - 5 * 60_000, now),
    ratePerHour,
    session: tracker.exp.total,
    sessionSeconds: tracker.exp.startT === undefined ? 0 : (now - tracker.exp.startT) / 1000,
    etaSeconds:
      remaining !== undefined && ratePerHour && ratePerHour > 0 ? (remaining / ratePerHour) * 3600 : undefined,
    levelsGained: tracker.levelsGained,
    mesos: { session: tracker.mesos.total, ratePerHour: tracker.mesos.ratePerHour(30 * 60_000, now) },
    noticesEnabled: s.noticesEnabled
  }
}

let broadcastQueued = false
function broadcast(): void {
  if (broadcastQueued) return
  broadcastQueued = true
  setTimeout(() => {
    broadcastQueued = false
    const snap = snapshot()
    for (const w of [overlay, settingsWin]) {
      if (w && !w.isDestroyed()) w.webContents.send('tracker:update', snap)
    }
  }, 150)
}

function setCaptureStatus(next: CaptureStatus): void {
  captureStatus = next
  broadcast()
}

// ---------------------------------------------------------------------------------------------
// Game window discovery

const isOwnWindow = (name: string): boolean => name.startsWith('OwlTrack')

async function listWindows(): Promise<WindowSourceInfo[]> {
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 0, height: 0 },
    fetchWindowIcons: false
  })
  return sources.filter((s) => s.name && !isOwnWindow(s.name)).map((s) => ({ id: s.id, name: s.name }))
}

async function searchForGame(): Promise<void> {
  clearTimeout(searchTimer)
  if (quitting) return
  try {
    const needle = store.value.windowTitle.trim().toLowerCase()
    const found = needle ? (await listWindows()).find((w) => w.name.toLowerCase().includes(needle)) : undefined
    if (found) {
      source = found
      setCaptureStatus({ state: 'starting', windowName: found.name })
      sendSource()
      return
    }
    setCaptureStatus({ state: 'searching', message: `Looking for a window named “${store.value.windowTitle}”…` })
  } catch (err) {
    setCaptureStatus({ state: 'error', message: String(err) })
  }
  searchTimer = setTimeout(() => void searchForGame(), SEARCH_INTERVAL_MS)
}

function sendSource(): void {
  if (capture && !capture.isDestroyed()) capture.webContents.send('capture:source', source)
}

function restartCapture(): void {
  source = null
  sendSource()
  void searchForGame()
}

// ---------------------------------------------------------------------------------------------
// Snapshots for calibration

let snapshotWaiter: ((jpeg: Uint8Array | null) => void) | null = null

function requestSnapshot(): Promise<string | null> {
  if (!capture || captureStatus.state !== 'streaming') return Promise.resolve(null)
  return new Promise((resolve) => {
    const timer = setTimeout(() => finish(null), 4000)
    const finish = (jpeg: Uint8Array | null): void => {
      clearTimeout(timer)
      snapshotWaiter = null
      resolve(jpeg ? `data:image/jpeg;base64,${Buffer.from(jpeg).toString('base64')}` : null)
    }
    snapshotWaiter = finish
    capture!.webContents.send('capture:snapshotRequest')
  })
}

// ---------------------------------------------------------------------------------------------
// OCR results -> tracker

async function handleRegion(key: RegionKey, png: Uint8Array): Promise<{ retry: boolean }> {
  const started = Date.now()
  const buf = Buffer.from(png)
  let text = ''
  let reader: 'glyph' | 'tesseract' = 'tesseract'
  let bitmap: Bitmap | undefined

  // EXP changes on every kill: read it with the learned glyph templates when possible.
  if (key === 'exp') {
    const img = nativeImage.createFromBuffer(buf)
    const size = img.getSize()
    bitmap = { data: img.toBitmap(), width: size.width, height: size.height, channels: 4 }
    // Every so often use Tesseract anyway, so templates keep being checked and refreshed.
    if (++expReads % CROSS_CHECK_EVERY !== 0) {
      const g = glyphs.readExp(bitmap)
      if (g) {
        text = g
        reader = 'glyph'
      }
    }
  }
  if (reader === 'tesseract') {
    try {
      text = await ocr.recognize(key, buf)
    } catch (err) {
      console.error('OCR failed', err)
      return { retry: false }
    }
  }
  const t = Date.now()
  let retry = false
  let parsed = '—'

  if (key === 'level') {
    const lv = parseLevel(text)
    if (lv !== undefined) {
      retry = tracker.ingestLevel(lv, t).retry
      parsed = `Lv. ${lv}`
    }
  } else if (key === 'exp') {
    const r = parseExp(text)
    if (r) {
      retry = tracker.ingestExp(r, t).retry
      parsed = `${r.exp.toLocaleString('en-US')} @ ${r.percent.toFixed(2)}%`
      const cur = tracker.current
      const accepted = cur?.exp === r.exp && cur.percent === r.percent
      if (accepted) {
        glyphRejects = 0
        // Only readings the tracker validated are used to teach the glyph matcher.
        if (reader === 'tesseract' && bitmap && glyphs.learnExp(bitmap, r.exp, r.percent)) {
          saveGlyphs()
          if (DEBUG)
            console.log(
              `[glyphs] learned; digits known per size: ${JSON.stringify(Object.fromEntries(Object.keys(glyphs.templates).map((h) => [h, glyphs.digitsKnown(Number(h))])))}`
            )
        }
      } else if (reader === 'glyph' && !retry && ++glyphRejects >= 3) {
        // Templates keep producing readings the tracker throws out: start learning again.
        console.warn('Glyph templates look wrong; relearning')
        glyphs.templates = {}
        glyphRejects = 0
        saveGlyphs()
      }
    }
  } else if (key === 'name') {
    const n = parseName(text)
    if (n.name) {
      // Require the same name twice before showing it.
      if (n.name === identity.candidate || n.name === identity.name) {
        identity = { name: n.name, job: n.job ?? identity.job }
      } else {
        identity.candidate = n.name
        retry = true
      }
      parsed = `${n.name}${n.job ? ` (${n.job})` : ''}`
    }
  } else if (key === 'notices') {
    const lines = text
      .split(/\r?\n/u)
      .map((l) => l.trim())
      .filter(Boolean)
    tracker.ingestNotices(lines, t)
    parsed = `${lines.filter((l) => parseMesoLine(l) !== undefined).length} meso line(s), session ${tracker.mesos.total}`
  }

  if (DEBUG) writeFileSync(join(app.getPath('temp'), `owltrack-${key}.png`), buf)
  if (DEBUG)
    console.log(
      `[ocr] ${key} ${reader} ${Date.now() - started}ms ${JSON.stringify(text.trim())} -> ${parsed}${retry ? ' (retry)' : ''}`
    )
  broadcast()
  if (settingsWin && !settingsWin.isDestroyed() && settingsWin.isVisible()) {
    const debug: RegionDebug = {
      key,
      text: text.trim(),
      parsed,
      image: `data:image/png;base64,${buf.toString('base64')}`,
      ms: Date.now() - started
    }
    settingsWin.webContents.send('debug:region', debug)
  }
  return { retry }
}

// ---------------------------------------------------------------------------------------------
// Overlay behaviour

function applyOverlaySettings(): void {
  if (!overlay || overlay.isDestroyed()) return
  const o = store.value.overlay
  overlay.setIgnoreMouseEvents(o.locked, { forward: true })
  overlay.setFocusable(!o.locked)
  overlay.setOpacity(Math.min(1, Math.max(0.2, o.opacity)))
  overlay.webContents.setZoomFactor(o.scale)
  if (o.visible) {
    overlay.showInactive()
    overlay.setAlwaysOnTop(true, 'screen-saver')
  } else {
    overlay.hide()
  }
  updateTrayMenu()
}

function toggleLock(): void {
  store.update({ overlay: { locked: !store.value.overlay.locked } })
}

function toggleVisible(): void {
  store.update({ overlay: { visible: !store.value.overlay.visible } })
}

function openSettings(): void {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show()
    settingsWin.focus()
    return
  }
  settingsWin = createSettingsWindow()
  settingsWin.on('closed', () => {
    settingsWin = null
  })
}

// ---------------------------------------------------------------------------------------------
// Tray

function trayIcon(): Electron.NativeImage {
  const file = join(app.getAppPath(), 'resources', 'tray.png')
  const img = nativeImage.createFromPath(file)
  return img.isEmpty() ? nativeImage.createEmpty() : img.resize({ width: 16, height: 16 })
}

function updateTrayMenu(): void {
  if (!tray) return
  const o = store.value.overlay
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Show overlay',
        type: 'checkbox',
        checked: o.visible,
        accelerator: SHORTCUT_TOGGLE,
        click: toggleVisible
      },
      {
        label: 'Lock overlay (click-through)',
        type: 'checkbox',
        checked: o.locked,
        accelerator: SHORTCUT_LOCK,
        click: toggleLock
      },
      { type: 'separator' },
      { label: 'Settings & calibration…', click: openSettings },
      {
        label: 'Reset session',
        click: () => {
          tracker.reset(Date.now())
          broadcast()
        }
      },
      { type: 'separator' },
      { label: 'Quit OwlTrack', role: 'quit' }
    ])
  )
}

function createTray(): void {
  tray = new Tray(trayIcon())
  tray.setToolTip('OwlTrack')
  tray.on('click', openSettings)
  updateTrayMenu()
}

// ---------------------------------------------------------------------------------------------
// IPC

function registerIpc(): void {
  ipcMain.handle('settings:get', () => store.value)
  ipcMain.handle('settings:update', (_e, patch: SettingsPatch) => store.update(patch))
  ipcMain.handle('tracker:get', () => snapshot())
  ipcMain.handle('tracker:reset', () => {
    tracker.reset(Date.now())
    broadcast()
  })
  ipcMain.handle('capture:listWindows', () => listWindows())
  ipcMain.handle('capture:snapshot', () => requestSnapshot())
  ipcMain.handle('ocr:region', (_e, key: RegionKey, png: Uint8Array) => handleRegion(key, png))

  ipcMain.on('capture:ready', () => {
    if (source) sendSource()
  })
  ipcMain.on('capture:status', (_e, status: CaptureStatus) => {
    setCaptureStatus({ ...status, windowName: status.windowName ?? source?.name })
    if (status.state === 'error' || status.state === 'idle') {
      // Stream ended (game closed/restarted) or failed: look for the window again.
      source = null
      clearTimeout(searchTimer)
      searchTimer = setTimeout(() => void searchForGame(), SEARCH_INTERVAL_MS)
    }
  })
  ipcMain.on('capture:snapshotResult', (_e, jpeg: Uint8Array | null) => snapshotWaiter?.(jpeg))
  ipcMain.on('app:openSettings', openSettings)
  // While locked the overlay is click-through, but mouse *moves* are still forwarded, so the
  // renderer can tell us when the pointer is over something clickable (the name's pencil).
  ipcMain.on('overlay:interactive', (_e, on: boolean) => {
    if (!overlay || overlay.isDestroyed() || !store.value.overlay.locked || editingOverlay) return
    overlay.setIgnoreMouseEvents(!on, { forward: true })
  })
  ipcMain.on('overlay:editing', (_e, on: boolean) => {
    if (!overlay || overlay.isDestroyed()) return
    editingOverlay = on
    if (on) {
      overlay.setIgnoreMouseEvents(false)
      overlay.setFocusable(true)
      overlay.focus()
    } else {
      // Hand focus back (Windows activates the window below, i.e. the game) and go click-through.
      overlay.blur()
      applyOverlaySettings()
    }
  })
  ipcMain.on('overlay:resize', (_e, width: number, height: number) => {
    if (!overlay || overlay.isDestroyed()) return
    const scale = store.value.overlay.scale
    const w = Math.ceil((width || OVERLAY_WIDTH) * scale)
    const h = Math.ceil(height * scale)
    const [cw, ch] = overlay.getContentSize()
    if (cw !== w || ch !== h) overlay.setContentSize(w, h)
  })
}

// ---------------------------------------------------------------------------------------------
// Lifecycle

app.on('second-instance', openSettings)

app.whenReady().then(() => {
  app.setAppUserModelId('com.sefiuzan.owltrack')
  migrateLegacyUserData()
  store = new SettingsStore()
  loadGlyphs()
  registerIpc()

  overlay = createOverlayWindow(store.value.overlay)
  overlay.once('ready-to-show', applyOverlaySettings)
  let moveTimer: NodeJS.Timeout | undefined
  overlay.on('moved', () => {
    clearTimeout(moveTimer)
    moveTimer = setTimeout(() => {
      if (!overlay || overlay.isDestroyed()) return
      const [x, y] = overlay.getPosition()
      store.update({ overlay: { x, y } })
    }, 300)
  })

  capture = createCaptureWindow()
  if (DEBUG) capture.webContents.on('console-message', (e) => console.log(e.message))
  capture.webContents.on('render-process-gone', () => {
    if (quitting) return
    capture?.destroy()
    capture = createCaptureWindow()
  })

  store.onChange((s, prev) => {
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send('settings:changed', s)
    }
    if (s.overlay !== prev.overlay) applyOverlaySettings()
    if (s.windowTitle !== prev.windowTitle) restartCapture()
    broadcast()
  })

  createTray()
  globalShortcut.register(SHORTCUT_LOCK, toggleLock)
  globalShortcut.register(SHORTCUT_TOGGLE, toggleVisible)

  ocr.preload()
  if (DEBUG) {
    setInterval(() => {
      const m = process.memoryUsage()
      const mb = (n: number): number => Math.round(n / 1_048_576)
      console.log(
        `[mem] rss=${mb(m.rss)} heapUsed=${mb(m.heapUsed)} external=${mb(m.external)} arrayBuffers=${mb(m.arrayBuffers)}`
      )
    }, 20_000)
  }
  void searchForGame()
  // Keeps time-based numbers (rates, ETA, session length) moving between readings.
  setInterval(() => {
    if (store.value.overlay.visible || settingsWin) broadcast()
  }, 1000)

  if (!store.value.regions.exp) openSettings()
})

// Tray app: closing the settings window must not quit.
app.on('window-all-closed', () => {
  // Intentionally empty: the tray keeps the app alive.
})

app.on('before-quit', () => {
  quitting = true
  // biome-ignore lint/suspicious/noUnnecessaryConditions: before-quit can fire before whenReady assigns the store.
  store?.flush()
  globalShortcut.unregisterAll()
  void ocr.dispose()
})
