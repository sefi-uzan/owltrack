import type {
  CaptureStatus,
  RegionDebug,
  RegionKey,
  Settings,
  SystemOptions,
  TrackerSnapshot,
  WindowSourceInfo
} from './types'

export type SettingsPatch = Partial<Omit<Settings, 'overlay'>> & { overlay?: Partial<Settings['overlay']> }

export type Unsubscribe = () => void

/** Everything the preload script exposes on `window.api`. */
export interface Api {
  getSettings: () => Promise<Settings>
  updateSettings: (patch: SettingsPatch) => Promise<Settings>
  onSettings: (cb: (s: Settings) => void) => Unsubscribe

  getSnapshot: () => Promise<TrackerSnapshot>
  onTracker: (cb: (s: TrackerSnapshot) => void) => Unsubscribe
  resetSession: () => Promise<void>

  listWindows: () => Promise<WindowSourceInfo[]>
  /** JPEG data URL of the current game frame, or null if no frame arrived. */
  takeSnapshot: () => Promise<string | null>
  onRegionDebug: (cb: (d: RegionDebug) => void) => Unsubscribe

  getSystemOptions: () => Promise<SystemOptions>
  setOpenAtLogin: (on: boolean) => Promise<SystemOptions>
  setDesktopShortcut: (on: boolean) => Promise<SystemOptions>
  /** Close the welcome screen; `openSettings` continues to settings (Calibrate tab if not calibrated). */
  finishSetup: (openSettings: boolean) => void

  openSettings: () => void
  resizeOverlay: (width: number, height: number) => void
  /** Let the (normally click-through) overlay receive mouse clicks while hovering something clickable. */
  setOverlayInteractive: (on: boolean) => void
  /** Give the overlay keyboard focus while editing text in it. */
  setOverlayEditing: (on: boolean) => void

  // Used by the hidden capture window only.
  captureReady: () => void
  captureStatus: (status: CaptureStatus) => void
  onCaptureSource: (cb: (source: WindowSourceInfo | null) => void) => Unsubscribe
  onSnapshotRequest: (cb: () => void) => Unsubscribe
  sendSnapshot: (jpeg: ArrayBuffer | null) => void
  ocrRegion: (key: RegionKey, png: ArrayBuffer) => Promise<{ retry: boolean }>
}
