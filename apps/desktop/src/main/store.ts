import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { SettingsPatch } from '@shared/api'
import { DEFAULT_SETTINGS, type Settings } from '@shared/types'
import { app } from 'electron'

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
      const raw = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<Settings>
      return {
        ...DEFAULT_SETTINGS,
        ...raw,
        thresholds: { ...DEFAULT_SETTINGS.thresholds, ...raw.thresholds },
        nameAliases: { ...raw.nameAliases },
        overlay: { ...DEFAULT_SETTINGS.overlay, ...raw.overlay }
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
