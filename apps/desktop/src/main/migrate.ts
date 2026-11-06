import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

/** User-data folder names the app used before it was renamed to OwlTrack. */
const LEGACY_DIRS = ['EXP Tracker']
const FILES = ['settings.json', 'glyphs.json']

/**
 * One-time carry-over of settings and learned glyphs from the pre-rename user-data folder,
 * so calibrations survive the rename. Never overwrites anything already in the new folder.
 */
export function migrateLegacyUserData(): void {
  const target = app.getPath('userData')
  if (existsSync(join(target, 'settings.json'))) return
  for (const name of LEGACY_DIRS) {
    const source = join(app.getPath('appData'), name)
    if (!existsSync(join(source, 'settings.json'))) continue
    try {
      mkdirSync(target, { recursive: true })
      for (const file of FILES) {
        if (existsSync(join(source, file))) copyFileSync(join(source, file), join(target, file))
      }
    } catch (err) {
      console.error('Failed to migrate settings from', source, err)
    }
    return
  }
}
