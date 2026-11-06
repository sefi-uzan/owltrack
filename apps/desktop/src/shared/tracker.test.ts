import { describe, expect, it } from 'vitest'
import { ExpTracker } from './tracker'

const MIN = 60_000

/** Ingest a reading twice (the capture loop retries when asked to). */
function feed(t: ExpTracker, exp: number, percent: number, at: number): void {
  if (t.ingestExp({ exp, percent }, at).retry) t.ingestExp({ exp, percent }, at + 100)
}
function level(t: ExpTracker, lv: number, at: number): void {
  if (t.ingestLevel(lv, at).retry) t.ingestLevel(lv, at + 100)
}

// Level 44 needs ~428,258 EXP: 66,380 is 15.50%.
const REQ = 428_258
const pct = (exp: number): number => Math.round((exp / REQ) * 10000) / 100

describe('ExpTracker', () => {
  it('needs two identical readings to set the baseline', () => {
    const t = new ExpTracker()
    expect(t.ingestExp({ exp: 66380, percent: 15.5 }, 0).retry).toBe(true)
    expect(t.current).toBeUndefined()
    expect(t.ingestExp({ exp: 66380, percent: 15.5 }, 100).retry).toBe(false)
    expect(t.current?.exp).toBe(66380)
  })

  it('accumulates gains and computes rates', () => {
    const t = new ExpTracker()
    feed(t, 66380, pct(66380), 0)
    let exp = 66380
    for (let m = 1; m <= 10; m++) {
      exp += 1000
      feed(t, exp, pct(exp), m * MIN)
    }
    expect(t.exp.total).toBe(10_000)
    expect(t.exp.gainSince(10 * MIN - 5 * MIN, 10 * MIN)).toBe(5000)
    expect(t.exp.ratePerHour(30 * MIN, 10 * MIN)).toBeCloseTo(60_000, -2)
  })

  it('rejects readings whose percent does not match the EXP (a misread digit)', () => {
    const t = new ExpTracker()
    feed(t, 66380, 15.5, 0)
    // 86380 at 15.51% is impossible for the same level.
    t.ingestExp({ exp: 86380, percent: 15.51 }, 1000)
    expect(t.current?.exp).toBe(66380)
    expect(t.exp.total).toBe(0)
  })

  it('credits a level-up when the bar resets', () => {
    const t = new ExpTracker()
    level(t, 44, 0)
    const start = REQ - 500
    feed(t, start, pct(start), 0)
    feed(t, 1200, 0.2, 1000)
    expect(t.levelsGained).toBe(1)
    expect(t.level).toBe(45)
    // Required EXP is estimated from the rounded percentage, so allow a little slack.
    expect(Math.abs(t.exp.total - (500 + 1200))).toBeLessThan(50)
    // The level box catching up must not double count.
    level(t, 45, 1500)
    expect(t.levelsGained).toBe(1)
  })

  it('uses the level box to tell a small-bar level-up from a death', () => {
    const t = new ExpTracker()
    level(t, 44, 0)
    feed(t, 66380, 15.5, 0)
    feed(t, 300, 0.05, 1000) // drop of 15 points: ambiguous
    level(t, 45, 1500)
    expect(t.levelsGained).toBe(1)
    expect(t.exp.total).toBe(REQ - 66380 + 300)
  })

  it('ignores a lower EXP reading when the percentage did not drop (misread digit)', () => {
    const t = new ExpTracker()
    feed(t, 66380, 15.5, 0)
    feed(t, 56380, 15.5, 1000)
    t.tick(10_000)
    expect(t.current?.exp).toBe(66380)
    expect(t.exp.total).toBe(0)
  })

  it('books a death penalty as a loss when the level does not change', () => {
    const t = new ExpTracker()
    level(t, 44, 0)
    feed(t, 66380, pct(66380), 0)
    const after = 66380 - 42826
    feed(t, after, pct(after), 1000)
    t.tick(10_000)
    expect(t.levelsGained).toBe(0)
    expect(t.exp.total).toBe(-42826)
  })

  it('counts each meso notice once and ignores other lines', () => {
    const t = new ExpTracker()
    t.reset(0)
    t.ingestNotices(['You have gained mesos (+52)', 'Maple Leaf x1 earned. (Etc)'], 0)
    t.ingestNotices(['You have gained mesos (+52)', 'You received EXP (+50)', 'You have gained mesos (+45)'], 500)
    t.ingestNotices(['You have gained mesos (+45)'], 1000)
    expect(t.mesos.total).toBe(97)
  })

  it('ignores meso amounts far above the typical drop (added-digit misreads)', () => {
    const t = new ExpTracker()
    t.reset(0)
    const drops = [53, 56, 57, 53, 63, 55]
    drops.forEach((m, i) => t.ingestNotices([`You have gained mesos (+${m})`], i * 1000))
    t.ingestNotices(['You have gained mesos (+503)'], 10_000) // really +53
    t.ingestNotices(['You have gained mesos (+58)'], 11_000)
    expect(t.mesos.total).toBe(drops.reduce((a, b) => a + b, 0) + 58)
  })

  it('takes back a misread that arrived before the outlier check had enough samples', () => {
    const t = new ExpTracker()
    t.reset(0)
    const seen = [55, 570, 54, 55, 64] // 570 is really 57, seen live
    seen.forEach((m, i) => t.ingestNotices([`You have gained mesos (+${m})`], i * 1000))
    expect(t.mesos.total).toBe(55 + 54 + 55 + 64)
  })
})
