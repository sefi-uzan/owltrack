import type { Api, SettingsPatch } from '@shared/api'
import {
  DEFAULT_SETTINGS,
  type RegionDebug,
  type Settings,
  type SystemOptions,
  type TrackerSnapshot
} from '@shared/types'
import desktop from '../../../desktop/package.json'
import { DEMO_REGIONS, FRAME, gameFrame, ocrMask } from './game-frame'

/**
 * A stand-in for the Electron preload API, so the desktop app's own Overlay and Settings
 * components (Overlay, Settings, Welcome) run in the browser. It simulates a grinding session: EXP ticks in, the rate and
 * time-to-level update, and every so often you level up. Nothing leaves the page.
 */

const TICK_MS = 1500
/** EXP per kill in the demo; ~2400 kills/h puts the rate around 10B/h. */
const KILL_EXP = 4_300_000

const START = {
  level: 215,
  required: 52_180_000_000,
  exp: 43_270_000_000,
  session: 7_412_000_000,
  sessionSeconds: 42 * 60 + 17
}

type Listener<T> = (value: T) => void

function emitter<T>() {
  const listeners = new Set<Listener<T>>()
  return {
    emit: (value: T): void => {
      for (const l of listeners) l(value)
    },
    on: (cb: Listener<T>): (() => void) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    }
  }
}

let settings: Settings = {
  ...DEFAULT_SETTINGS,
  regions: { ...DEMO_REGIONS },
  setupDone: true
}

let system: SystemOptions = { packaged: true, version: desktop.version, openAtLogin: true, desktopShortcut: true }

const state = {
  level: START.level,
  required: START.required,
  exp: START.exp,
  session: START.session,
  sessionSeconds: START.sessionSeconds,
  levelsGained: 0,
  /** Recent kills, for the "last 5 minutes" figure. */
  recent: [] as { at: number; exp: number }[]
}

const startedAt = Date.now()
const NAME = 'Owlbert'
const JOB = 'Bishop'

const settingsEvents = emitter<Settings>()
const trackerEvents = emitter<TrackerSnapshot>()
const debugEvents = emitter<RegionDebug>()

const percent = (): number => Math.floor((state.exp / state.required) * 10_000) / 100

function snapshot(): TrackerSnapshot {
  const rate = state.sessionSeconds > 0 ? (state.session / state.sessionSeconds) * 3600 : undefined
  // Before the first five real minutes, extrapolate from the session average.
  const cutoff = Date.now() - 5 * 60_000
  const recent = state.recent.filter((k) => k.at >= cutoff).reduce((sum, k) => sum + k.exp, 0)
  const elapsed = Math.min(300, (Date.now() - startedAt) / 1000)
  const last5m = recent + (rate ? (rate / 3600) * (300 - elapsed) : 0)
  return {
    capture: { state: 'streaming', windowName: 'MapleStory', frameWidth: FRAME.width, frameHeight: FRAME.height },
    calibrated: Boolean(settings.regions.exp),
    level: settings.regions.level ? state.level : undefined,
    name: settings.regions.name ? (NAME in settings.nameAliases ? settings.nameAliases[NAME] : NAME) : undefined,
    detectedName: settings.regions.name ? NAME : undefined,
    job: settings.regions.name ? JOB : undefined,
    exp: settings.regions.exp ? state.exp : undefined,
    percent: settings.regions.exp ? percent() : undefined,
    required: state.required,
    last5m,
    ratePerHour: rate,
    session: state.session,
    sessionSeconds: state.sessionSeconds,
    etaSeconds: rate ? ((state.required - state.exp) / rate) * 3600 : undefined,
    levelsGained: state.levelsGained
  }
}

function emitDebug(): void {
  const exp = `${state.exp}[${percent().toFixed(2)}%]`
  const reads: [RegionDebug['key'], string, string, number][] = [
    ['exp', exp, `${state.exp.toLocaleString('en-US')} · ${percent().toFixed(2)}%`, 1],
    ['level', String(state.level), `Lv. ${state.level}`, 38],
    ['name', `${JOB}\n${NAME}`, NAME, 46]
  ]
  for (const [key, text, parsed, ms] of reads) {
    if (!settings.regions[key]) continue
    debugEvents.emit({ key, text, parsed, image: ocrMask(text), ms: ms + Math.floor(Math.random() * 6) })
  }
}

function tick(): void {
  state.sessionSeconds += TICK_MS / 1000
  // Not every tick is a kill, and kills vary a little.
  if (Math.random() < 0.85) {
    const gained = Math.round(KILL_EXP * (0.8 + Math.random() * 0.4))
    state.exp += gained
    state.session += gained
    state.recent.push({ at: Date.now(), exp: gained })
    if (state.exp >= state.required) {
      state.exp -= state.required
      state.level++
      state.levelsGained++
      state.required = Math.round(state.required * 1.06)
    }
    emitDebug()
  }
  const cutoff = Date.now() - 5 * 60_000
  state.recent = state.recent.filter((k) => k.at >= cutoff)
  trackerEvents.emit(snapshot())
}

setInterval(tick, TICK_MS)

function applyPatch(patch: SettingsPatch): Settings {
  settings = { ...settings, ...patch, overlay: { ...settings.overlay, ...patch.overlay } }
  settingsEvents.emit(settings)
  trackerEvents.emit(snapshot())
  return settings
}

const noop = (): void => undefined
const never = (): (() => void) => noop

/** Hooks the landing page uses to react to clicks inside the demo (e.g. the overlay's settings button). */
export const demoEvents = { openSettings: emitter<void>(), finishSetup: emitter<boolean>() }

/** Screenshot mode: show the app before calibration (welcome screen, empty Calibrate tab). */
export function startUncalibrated(): void {
  settings = { ...settings, regions: {}, setupDone: false }
  system = { ...system, openAtLogin: false }
}

export const mockApi: Api = {
  getSettings: () => Promise.resolve(settings),
  updateSettings: (patch) => Promise.resolve(applyPatch(patch)),
  onSettings: settingsEvents.on,

  getSnapshot: () => Promise.resolve(snapshot()),
  onTracker: trackerEvents.on,
  resetSession: () => {
    state.session = 0
    state.sessionSeconds = 0
    state.levelsGained = 0
    state.recent = []
    trackerEvents.emit(snapshot())
    return Promise.resolve()
  },

  listWindows: () =>
    Promise.resolve([
      { id: 'window:1', name: 'MapleStory' },
      { id: 'window:2', name: 'OwlTrack — Settings' },
      { id: 'window:3', name: 'Discord' }
    ]),
  takeSnapshot: () =>
    Promise.resolve(
      gameFrame({
        level: state.level,
        job: JOB,
        name: NAME,
        exp: state.exp,
        percent: percent()
      })
    ),
  onRegionDebug: (cb) => {
    const off = debugEvents.on(cb)
    // Fill the calibrator previews straight away instead of after the next kill.
    queueMicrotask(() => emitDebug())
    return off
  },

  getSystemOptions: () => Promise.resolve(system),
  setOpenAtLogin: (on) => Promise.resolve((system = { ...system, openAtLogin: on })),
  setDesktopShortcut: (on) => Promise.resolve((system = { ...system, desktopShortcut: on })),
  finishSetup: (openSettings) => demoEvents.finishSetup.emit(openSettings),

  openSettings: () => demoEvents.openSettings.emit(),
  resizeOverlay: noop,
  setOverlayInteractive: noop,
  setOverlayEditing: noop,

  captureReady: noop,
  captureStatus: noop,
  onCaptureSource: never,
  onSnapshotRequest: never,
  sendSnapshot: noop,
  ocrRegion: () => Promise.resolve({ retry: false })
}
