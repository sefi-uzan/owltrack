import { describe, expect, it } from 'vitest'
import { ExpTracker, oneDigitEdits } from './tracker'

const MIN = 60_000

/** Ingest a reading twice (the capture loop retries when asked to). */
function feed(t: ExpTracker, exp: number, percent: number, at: number): void {
  if (t.ingestExp({ exp, percent }, at).retry) t.ingestExp({ exp, percent }, at + 100)
}
function level(t: ExpTracker, lv: number, at: number): void {
  if (t.ingestLevel(lv, at).retry) t.ingestLevel(lv, at + 100)
}

// Level 44 needs 428,280 EXP (Classic table): 66,380 is 15.50%.
const REQ = 428_280
const REQ_45 = 468_450
const pct = (exp: number): number => Math.round((exp / REQ) * 10_000) / 100

describe('ExpTracker', () => {
  it('needs two identical readings to set the baseline', () => {
    const t = new ExpTracker()
    expect(t.ingestExp({ exp: 66_380, percent: 15.5 }, 0).retry).toBe(true)
    expect(t.current).toBeUndefined()
    expect(t.ingestExp({ exp: 66_380, percent: 15.5 }, 100).retry).toBe(false)
    expect(t.current?.exp).toBe(66_380)
  })

  it('accumulates gains and computes rates', () => {
    const t = new ExpTracker()
    feed(t, 66_380, pct(66_380), 0)
    let exp = 66_380
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
    feed(t, 66_380, 15.5, 0)
    // 86380 at 15.51% is impossible for the same level.
    t.ingestExp({ exp: 86_380, percent: 15.51 }, 1000)
    expect(t.current?.exp).toBe(66_380)
    expect(t.exp.total).toBe(0)
  })

  it('credits a level-up when the bar resets', () => {
    const t = new ExpTracker()
    level(t, 44, 0)
    const start = REQ - 500
    feed(t, start, pct(start), 0)
    feed(t, 1200, 0.25, 1000)
    expect(t.levelsGained).toBe(1)
    expect(t.level).toBe(45)
    // The table gives the exact EXP that was left at level 44.
    expect(t.exp.total).toBe(500 + 1200)
    expect(t.current?.required).toBe(REQ_45)
    // The level box catching up must not double count.
    level(t, 45, 1500)
    expect(t.levelsGained).toBe(1)
  })

  it('uses the level box to tell a small-bar level-up from a death', () => {
    const t = new ExpTracker()
    level(t, 44, 0)
    feed(t, 66_380, 15.5, 0)
    // 250 EXP shows as 0.05% at both level 44 and 45, and the drop is only 15 points: ambiguous.
    feed(t, 250, 0.05, 1000)
    expect(t.levelsGained).toBe(0)
    level(t, 45, 1500)
    expect(t.levelsGained).toBe(1)
    expect(t.exp.total).toBe(REQ - 66_380 + 250)
    expect(t.current?.required).toBe(REQ_45)
  })

  it('ignores a lower EXP reading when the percentage did not drop (misread digit)', () => {
    const t = new ExpTracker()
    feed(t, 66_380, 15.5, 0)
    feed(t, 56_380, 15.5, 1000)
    t.tick(10_000)
    expect(t.current?.exp).toBe(66_380)
    expect(t.exp.total).toBe(0)
  })

  it('books a death penalty as a loss when the level does not change', () => {
    const t = new ExpTracker()
    level(t, 44, 0)
    feed(t, 66_380, pct(66_380), 0)
    const after = 66_380 - 42_826
    feed(t, after, pct(after), 1000)
    t.tick(10_000)
    expect(t.levelsGained).toBe(0)
    expect(t.exp.total).toBe(-42_826)
  })

  it('uses the exact table requirement even at a very low percentage', () => {
    const t = new ExpTracker()
    level(t, 44, 0)
    feed(t, 1000, 0.23, 0)
    expect(t.current?.required).toBe(REQ)
    feed(t, 1900, 0.44, 1000)
    expect(t.exp.total).toBe(900)
  })

  it('rejects a gain that does not fit the EXP table, even if the estimate is close', () => {
    const t = new ExpTracker()
    level(t, 44, 0)
    feed(t, 66_380, 15.5, 0)
    // 15.60% of 428,280 is about 66,812. 67,200 passes the old ~2% estimate check, and no single
    // digit change turns it into a value that fits.
    const res = t.ingestExp({ exp: 67_200, percent: 15.6 }, 1000)
    expect(res.corrected).toBeUndefined()
    expect(t.current?.exp).toBe(66_380)
    expect(t.exp.total).toBe(0)
  })

  it('corrects a reading with one misread EXP digit', () => {
    const t = new ExpTracker()
    level(t, 44, 0)
    feed(t, 66_380, 15.5, 0)
    // The real value is 67,500 (15.76%); the 7 was read as a 1.
    const res = t.ingestExp({ exp: 61_500, percent: 15.76 }, 1000)
    expect(res.corrected).toEqual({ exp: 67_500, percent: 15.76 })
    expect(t.current?.exp).toBe(67_500)
    expect(t.exp.total).toBe(1120)
  })

  it('does not guess when several one-digit fixes fit', () => {
    const t = new ExpTracker()
    level(t, 44, 0)
    feed(t, 66_380, 15.5, 0)
    // 67,580 does not fit 15.76%, but 67,480, 67,500, 67,510, 67,520 and 67,530 all do.
    const res = t.ingestExp({ exp: 67_580, percent: 15.76 }, 1000)
    expect(res.corrected).toBeUndefined()
    expect(t.current?.exp).toBe(66_380)
  })

  it("detects a level-up from the next level's EXP when the level box is missing", () => {
    const t = new ExpTracker()
    level(t, 44, 0)
    feed(t, 21_414, 5, 0)
    // 20,000 EXP is 4.27% of level 45, but would be 4.67% at level 44.
    feed(t, 20_000, 4.27, 1000)
    expect(t.levelsGained).toBe(1)
    expect(t.level).toBe(45)
    expect(t.exp.total).toBe(REQ - 21_414 + 20_000)
  })

  it('falls back to estimates when the EXP does not fit the level that was read', () => {
    const t = new ExpTracker()
    level(t, 30, 0) // misread: 66,380 is more than level 30 needs
    feed(t, 66_380, 15.5, 0)
    expect(t.current?.exp).toBe(66_380)
    feed(t, 67_380, pct(67_380), 1000)
    expect(t.exp.total).toBe(1000)
  })
})

describe('oneDigitEdits', () => {
  it('changes, drops or adds one digit, without leading zeros', () => {
    const e = oneDigitEdits(105)
    expect(e.has(185)).toBe(true)
    expect(e.has(15)).toBe(true)
    expect(e.has(1055)).toBe(true)
    expect(e.has(5)).toBe(false)
    expect(e.has(105)).toBe(false)
  })
})
