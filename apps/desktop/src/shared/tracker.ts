import { expToNext, fitsTable } from './exp-table'
import type { ExpReading } from './parse'

const MIN = 60_000

/** Running total with timestamped samples, so we can ask "how much in the last N minutes". */
export class Counter {
  total = 0
  startT?: number
  private samples: { t: number; v: number }[] = []

  start(t: number): void {
    this.total = 0
    this.startT = t
    this.samples = [{ t, v: 0 }]
  }

  add(delta: number, t: number): void {
    if (this.startT === undefined) this.start(t)
    this.total += delta
    this.samples.push({ t, v: this.total })
    this.prune(t)
  }

  /** Total at time t (step function). */
  valueAt(t: number): number {
    let v = 0
    for (const s of this.samples) {
      if (s.t > t) break
      v = s.v
    }
    return v
  }

  gainSince(t: number, now: number): number {
    if (this.startT === undefined) return 0
    return this.valueAt(now) - this.valueAt(Math.max(t, this.startT))
  }

  /** Per-hour rate over the trailing window (shrinks to the session length when shorter). */
  ratePerHour(windowMs: number, now: number, minMs = 30_000): number | undefined {
    if (this.startT === undefined) return undefined
    const from = Math.max(this.startT, now - windowMs)
    const dur = now - from
    if (dur < minMs) return undefined
    return (this.gainSince(from, now) / dur) * 3_600_000
  }

  private prune(now: number): void {
    const cutoff = now - 31 * MIN
    let i = 0
    while (i + 1 < this.samples.length && this.samples[i + 1].t <= cutoff) i++
    if (i > 0) this.samples.splice(0, i)
  }
}

export interface IngestResult {
  /** Ask the capture loop to OCR this region again on the next frame. */
  retry: boolean
  /** The reading had a misread digit; this is the value the EXP table says it must have been. */
  corrected?: ExpReading
}

interface Accepted extends ExpReading {
  required?: number
  /** `required` comes from the EXP table (level known and the reading agrees with it). */
  fromTable?: boolean
}

export function requiredFrom(r: ExpReading): number | undefined {
  // Below ~0.5% the rounded percentage makes the estimate useless.
  return r.percent >= 0.5 ? Math.round((r.exp * 100) / r.percent) : undefined
}

function consistent(a: number | undefined, b: number | undefined, percent: number): boolean {
  if (a === undefined || b === undefined || percent < 2) return true
  const tolerance = 0.02 + (2 * 0.005) / percent
  return Math.abs(a - b) / b <= tolerance
}

const same = (a: ExpReading, b: ExpReading): boolean => a.exp === b.exp && a.percent === b.percent

/** Every number one digit away from `n`: one digit changed, dropped or added. */
export function oneDigitEdits(n: number): Set<number> {
  const s = String(n)
  const out = new Set<number>()
  const add = (c: string): void => {
    if (c && (c.length === 1 || c[0] !== '0')) out.add(Number(c))
  }
  for (let i = 0; i <= s.length; i++) {
    if (i < s.length) add(s.slice(0, i) + s.slice(i + 1))
    for (let d = 0; d <= 9; d++) {
      add(s.slice(0, i) + d + s.slice(i))
      if (i < s.length) add(s.slice(0, i) + d + s.slice(i + 1))
    }
  }
  out.delete(n)
  return out
}

/** Attach the required EXP: exact from the table when the reading fits it, else estimated. */
function withRequired(r: ExpReading, level: number | undefined): Accepted {
  const table = expToNext(level)
  if (table !== undefined && fitsTable(r.exp, r.percent, table))
    return { exp: r.exp, percent: r.percent, required: table, fromTable: true }
  return { exp: r.exp, percent: r.percent, required: requiredFrom(r) }
}

/** A gain that fits the table, in a plausible range, one digit away from what we read. */
function correctGain(r: ExpReading, prev: Accepted): Accepted | undefined {
  const required = prev.required
  if (!prev.fromTable || required === undefined || r.percent < prev.percent) return undefined
  const fits = [...oneDigitEdits(r.exp)].filter(
    (exp) => exp > prev.exp && exp - prev.exp <= required * 0.5 && fitsTable(exp, r.percent, required)
  )
  return fits.length === 1 ? { exp: fits[0], percent: r.percent, required, fromTable: true } : undefined
}

/** How long we wait for the level box to confirm a level-up after EXP drops. */
const LEVEL_WAIT_MS = 4000

/**
 * Turns individual OCR readings into session statistics.
 *
 * OCR is noisy, so every reading is sanity-checked: EXP and percentage must agree on the EXP
 * required for the level, drops in EXP must be seen twice, and a drop is classified as either a
 * level-up (level box went up, the bar emptied, or the EXP fits the next level) or a death penalty.
 *
 * When the level is known, the required EXP comes from the Classic World EXP table instead of being
 * estimated from the rounded percentage. That check is exact, so a reading with one misread EXP
 * digit can often be corrected: if exactly one one-digit edit fits the table, it is used.
 */
export class ExpTracker {
  readonly exp = new Counter()
  level?: number
  levelsGained = 0

  private accepted?: Accepted
  private candidate?: ExpReading
  private rejected: Accepted[] = []
  private levelCandidate?: number
  /** Level went up before the EXP bar reset. */
  private levelUpFrom?: { from: Accepted; t: number }
  /** EXP went down; waiting to learn whether it was a level-up or a death. */
  private pendingDrop?: { from: Accepted; to: Accepted; t: number }

  get current(): Accepted | undefined {
    return this.accepted
  }

  reset(t: number): void {
    this.exp.start(t)
    this.levelsGained = 0
    this.pendingDrop = undefined
    this.levelUpFrom = undefined
  }

  /** Forget everything, e.g. when switching characters. */
  clear(): void {
    this.accepted = undefined
    this.candidate = undefined
    this.rejected = []
    this.level = undefined
    this.levelCandidate = undefined
    this.levelsGained = 0
    this.pendingDrop = undefined
    this.levelUpFrom = undefined
    this.exp.startT = undefined
    this.exp.total = 0
  }

  /** Call periodically so pending decisions resolve even without new readings. */
  tick(t: number): void {
    if (this.pendingDrop && t - this.pendingDrop.t > LEVEL_WAIT_MS) {
      // No level-up confirmation: it was EXP loss (death penalty).
      const { from, to } = this.pendingDrop
      this.pendingDrop = undefined
      this.exp.add(to.exp - from.exp, t)
    }
    if (this.levelUpFrom && t - this.levelUpFrom.t > LEVEL_WAIT_MS * 2) this.levelUpFrom = undefined
  }

  ingestExp(r: ExpReading, t: number): IngestResult {
    this.tick(t)
    const reading = withRequired(r, this.level)
    const prev = this.accepted

    if (!prev) {
      if (this.candidate && same(this.candidate, r)) {
        this.accepted = reading
        this.candidate = undefined
        if (this.exp.startT === undefined) this.reset(t)
        return { retry: false }
      }
      this.candidate = r
      return { retry: true }
    }

    if (same(prev, r)) {
      this.candidate = undefined
      this.rejected = []
      return { retry: false }
    }

    if (prev.fromTable && !reading.fromTable) {
      const fixed = correctGain(r, prev)
      if (fixed) {
        this.candidate = undefined
        this.accept(fixed)
        this.exp.add(fixed.exp - prev.exp, t)
        return { retry: false, corrected: { exp: fixed.exp, percent: fixed.percent } }
      }
    }

    const delta = r.exp - prev.exp
    if (delta > 0) {
      const plausibleSize = prev.required === undefined || delta <= prev.required * 0.5
      // Against the table only an exact fit counts; without it, compare the two estimates.
      const agrees = prev.fromTable
        ? reading.fromTable
        : reading.fromTable || consistent(reading.required, prev.required, r.percent)
      if (agrees && r.percent >= prev.percent && plausibleSize) {
        this.accept(reading)
        this.exp.add(delta, t)
        return { retry: false }
      }
      return this.reject(reading)
    }

    // EXP went down. The percentage must have gone down with it, otherwise it's a misread digit.
    if (r.percent >= prev.percent) return this.reject(reading)
    // ...and it must be seen twice to rule out a half-rendered frame.
    if (!(this.candidate && same(this.candidate, r))) {
      this.candidate = r
      return { retry: true }
    }
    this.candidate = undefined

    if (this.levelUpFrom) {
      this.creditLevelUp(this.levelUpFrom.from, reading, t, false)
      this.levelUpFrom = undefined
      return { retry: false }
    }
    // A big drop of the bar can only be a level-up (death costs at most ~10%).
    if (prev.percent - r.percent > 20) {
      this.creditLevelUp(prev, reading, t, true)
      return { retry: false }
    }
    // Fits the next level's EXP but not this one's: a level-up the level box hasn't shown yet.
    const next = expToNext(this.level === undefined ? undefined : this.level + 1)
    if (prev.fromTable && !reading.fromTable && next !== undefined && fitsTable(r.exp, r.percent, next)) {
      this.creditLevelUp(prev, reading, t, true)
      return { retry: false }
    }
    // A death keeps the level, so EXP and percentage must still agree with the same requirement.
    const keepsLevel = prev.fromTable ? reading.fromTable : consistent(reading.required, prev.required, r.percent)
    if (!keepsLevel) return this.reject(reading)
    this.pendingDrop = { from: prev, to: reading, t }
    this.accept(reading)
    return { retry: false }
  }

  ingestLevel(level: number, t: number): IngestResult {
    this.tick(t)
    if (level === this.level) {
      this.levelCandidate = undefined
      return { retry: false }
    }
    if (this.levelCandidate !== level) {
      this.levelCandidate = level
      return { retry: true }
    }
    this.levelCandidate = undefined

    if (this.level !== undefined && level === this.level + 1) {
      this.level = level
      if (this.pendingDrop) {
        const { from, to } = this.pendingDrop
        this.pendingDrop = undefined
        // No gain was booked for the drop yet; gains after it were booked relative to `to`.
        this.creditLevelUp(from, to, t, false, true)
      } else if (this.accepted) {
        this.levelUpFrom = { from: this.accepted, t }
      }
      return { retry: false }
    }

    if (this.level !== undefined) {
      // Different character (or a level we couldn't follow): start over from this reading.
      this.clear()
    }
    this.level = level
    if (this.accepted) this.accepted = withRequired(this.accepted, this.level)
    return { retry: false }
  }

  private creditLevelUp(from: Accepted, to: Accepted, t: number, bumpLevel: boolean, alreadyAccepted = false): void {
    const remaining = from.required === undefined ? 0 : Math.max(0, from.required - from.exp)
    this.exp.add(remaining + to.exp, t)
    this.levelsGained++
    if (bumpLevel && this.level !== undefined) this.level++
    // The new level has a new requirement; readings taken before we knew must be re-checked.
    if (!alreadyAccepted) this.accept(withRequired(to, this.level))
    else if (this.accepted) this.accepted = withRequired(this.accepted, this.level)
  }

  private accept(r: Accepted): void {
    this.accepted = r
    this.rejected = []
  }

  private reject(r: Accepted): IngestResult {
    this.rejected.push(r)
    if (this.rejected.length > 3) this.rejected.shift()
    // Three different readings that agree with each other but not with our baseline:
    // trust them and re-baseline without booking any gain.
    if (this.rejected.length === 3) {
      const [a, b, c] = this.rejected
      if (
        a.required !== undefined &&
        consistent(b.required, a.required, b.percent) &&
        consistent(c.required, a.required, c.percent) &&
        a.exp <= b.exp &&
        b.exp <= c.exp
      ) {
        this.accept(c)
        return { retry: false }
      }
    }
    return { retry: false }
  }
}
