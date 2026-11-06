import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { SettingsPatch } from '@shared/api'
import { DEFAULT_SETTINGS, REGION_KEYS, type RegionKey, type Settings } from '@shared/types'
import { app } from 'electron'

/** Keep only the regions the app still reads (older versions also had a meso "notices" region). */
function known<T>(values: Partial<Record<string, T>> | undefined): Partial<Record<RegionKey, T>> {
  const out: Partial<Record<RegionKey, T>> = {}
  for (const k of REGION_KEYS) if (values?.[k] !== undefined) out[k] = values[k]
  return out
}

/** Tiny JSON settings store in the user-data folder (writes are debounced). */
export class SettingsStore {
  private readonly file = join(app.getPath('userData'), 'settings.json')
  private timer?: NodeJS.Timeout
  private readonly listeners = new Set<(s: Settings, prev: Settings) => void>()
  value: Settings

  constructor() {
    this.value = this.load()
  }

  private load(): Settings {
    try {
      // trimStart() also drops a BOM (U+FEFF): Notepad/PowerShell can add one, and JSON.parse rejects it.
      // noticesEnabled is from the removed meso counter; drop it so it isn't written back.
      const { noticesEnabled: _, ...raw } = JSON.parse(
        readFileSync(this.file, 'utf8').trimStart()
      ) as Partial<Settings> & {
        noticesEnabled?: boolean
      }
      return {
        ...DEFAULT_SETTINGS,
        ...raw,
        regions: known(raw.regions),
        thresholds: { ...DEFAULT_SETTINGS.thresholds, ...known(raw.thresholds) },
        nameAliases: { ...raw.nameAliases },
        overlay: { ...DEFAULT_SETTINGS.overlay, ...raw.overlay },
        // Settings from before the welcome screen existed: only show it if nothing was calibrated yet.
        setupDone: raw.setupDone ?? Boolean(raw.regions?.exp)
      }
    } catch {
      return structuredClone(DEFAULT_SETTINGS)
    }
  }

  update(patch: SettingsPatch): Settings {
    const prev = this.value
    this.value = {
      ...prev,
      ...patch,
      thresholds: { ...prev.thresholds, ...patch.thresholds },
      overlay: { ...prev.overlay, ...patch.overlay }
    }
    this.scheduleSave()
    for (const l of this.listeners) l(this.value, prev)
    return this.value
  }

  onChange(cb: (s: Settings, prev: Settings) => void): void {
    this.listeners.add(cb)
  }

  private scheduleSave(): void {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), 400)
  }

  flush(): void {
    clearTimeout(this.timer)
    try {
      mkdirSync(dirname(this.file), { recursive: true })
      writeFileSync(this.file, JSON.stringify(this.value, null, 2))
    } catch (err) {
      console.error('Failed to save settings', err)
    }
  }
}
