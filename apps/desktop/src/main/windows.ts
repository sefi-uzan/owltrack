import { join } from 'node:path'
import { BrowserWindow, screen } from 'electron'

export type Page = 'overlay' | 'settings' | 'capture'

const preload = join(__dirname, '../preload/index.js')

function load(win: BrowserWindow, page: Page): void {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) void win.loadURL(`${devUrl}/${page}.html`)
  else void win.loadFile(join(__dirname, `../renderer/${page}.html`))
}

export const OVERLAY_WIDTH = 340

export function createOverlayWindow(pos: { x?: number; y?: number }): BrowserWindow {
  const work = screen.getPrimaryDisplay().workArea
  const onScreen =
    pos.x !== undefined &&
    pos.y !== undefined &&
    screen.getAllDisplays().some((d) => {
      const b = d.workArea
      return pos.x! >= b.x - 50 && pos.x! < b.x + b.width - 50 && pos.y! >= b.y - 20 && pos.y! < b.y + b.height - 50
    })

  const win = new BrowserWindow({
    title: 'OwlTrack',
    width: OVERLAY_WIDTH,
    height: 190,
    x: onScreen ? pos.x : work.x + work.width - OVERLAY_WIDTH - 24,
    y: onScreen ? pos.y : work.y + 24,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    // Never take keyboard focus away from the game.
    focusable: false,
    show: false,
    webPreferences: { preload, sandbox: true, backgroundThrottling: false }
  })
  // 'screen-saver' is the highest z-level; it keeps us above borderless/windowed games.
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setMenu(null)
  load(win, 'overlay')
  return win
}

export function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    title: 'OwlTrack — Settings',
    width: 1000,
    height: 680,
    minWidth: 820,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#141824',
    webPreferences: { preload, sandbox: true }
  })
  win.setMenu(null)
  win.once('ready-to-show', () => win.show())
  load(win, 'settings')
  return win
}

/** Hidden window that owns the game-window video stream and does the pixel work. */
export function createCaptureWindow(): BrowserWindow {
  const win = new BrowserWindow({
    title: 'OwlTrack — Capture',
    width: 320,
    height: 240,
    show: false,
    skipTaskbar: true,
    webPreferences: { preload, sandbox: true, backgroundThrottling: false }
  })
  load(win, 'capture')
  return win
}
