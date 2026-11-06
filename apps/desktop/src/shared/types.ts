/** Screen regions inside the game window that we OCR. */
export type RegionKey = 'level' | 'name' | 'exp'

export const REGION_KEYS: RegionKey[] = ['level', 'name', 'exp']

/** A rectangle normalised to the captured frame (0..1 on both axes). */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface OverlaySettings {
  x?: number
  y?: number
  scale: number
  opacity: number
  /** Locked = click-through; the overlay never steals the mouse from the game. */
  locked: boolean
  visible: boolean
}

export interface Settings {
  /** Case-insensitive substring of the game window title. */
  windowTitle: string
  regions: Partial<Record<RegionKey, Rect>>
  thresholds: Thresholds
  /** Frames per second pulled from the game window. Only changed regions are OCR'd. */
  captureFps: number
  /** Spelling fixes for OCR'd names, e.g. { "Ynsht": "Ynshf" } — OCR confuses f/t, l/I in the game font. */
  nameAliases: Record<string, string>
  overlay: OverlaySettings
  /** The first-run welcome screen has been shown (and finished or dismissed). */
  setupDone: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  windowTitle: 'MapleStory',
  regions: {},
  // Name uses a low cut-off: the thin crossbar of letters like "f" vanishes above ~120 ("Ynshf" -> "Ynsht").
  thresholds: { level: 170, name: 110, exp: 145 },
  captureFps: 4,
  nameAliases: {},
  overlay: { scale: 1, opacity: 1, locked: true, visible: true },
  setupDone: false
}

/** Windows integration that lives outside settings.json (registry, desktop). */
export interface SystemOptions {
  /** False when running from source: there's no installed exe to point Windows at. */
  packaged: boolean
  version: string
  openAtLogin: boolean
  desktopShortcut: boolean
}

export type CaptureState = 'idle' | 'searching' | 'starting' | 'streaming' | 'error'

export interface CaptureStatus {
  state: CaptureState
  message?: string
  windowName?: string
  frameWidth?: number
  frameHeight?: number
}

export interface TrackerSnapshot {
  capture: CaptureStatus
  calibrated: boolean
  level?: number
  name?: string
  /** Raw OCR result before nameAliases are applied. */
  detectedName?: string
  job?: string
  exp?: number
  percent?: number
  /** EXP needed for the current level, derived from exp / percent. */
  required?: number
  /** Net EXP gained in the last 5 minutes. */
  last5m: number
  /** EXP per hour over the last 30 minutes (or the session, if shorter). */
  ratePerHour?: number
  /** Net EXP gained since the session started. */
  session: number
  sessionSeconds: number
  etaSeconds?: number
  levelsGained: number
}

/** Latest raw OCR output per region; shown in the calibration screen. */
export interface RegionDebug {
  key: RegionKey
  text: string
  parsed: string
  image: string // data URL of the processed image Tesseract saw
  ms: number
}

export interface WindowSourceInfo {
  id: string
  name: string
}

/** Brightness cut-off (0-255) separating text from background, per region. */
export type Thresholds = Record<RegionKey, number>
