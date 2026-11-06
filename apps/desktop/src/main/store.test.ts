import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { SettingsStore } from './store'

const dir = mkdtempSync(join(tmpdir(), 'owltrack-store-'))
// The store only asks for the user-data folder when it's constructed, after `dir` exists.
vi.mock('electron', () => ({ app: { getPath: () => dir } }))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const rect = { x: 0.1, y: 0.9, w: 0.2, h: 0.03 }

describe('SettingsStore', () => {
  it('drops the removed meso counter settings from an older settings.json', () => {
    writeFileSync(
      join(dir, 'settings.json'),
      JSON.stringify({
        windowTitle: 'MapleStory',
        regions: { exp: rect, notices: rect },
        thresholds: { exp: 150, notices: 140 },
        noticesEnabled: true
      })
    )
    const store = new SettingsStore()
    expect(store.value.regions).toEqual({ exp: rect })
    expect(store.value.thresholds).toEqual({ level: 170, name: 110, exp: 150 })
    expect(store.value).not.toHaveProperty('noticesEnabled')

    store.flush()
    const saved = JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8'))
    expect(saved.regions).toEqual({ exp: rect })
    expect(saved.thresholds).not.toHaveProperty('notices')
    expect(saved).not.toHaveProperty('noticesEnabled')
  })
})
