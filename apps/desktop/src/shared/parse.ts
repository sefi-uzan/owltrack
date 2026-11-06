/**
 * Turns noisy OCR text from the MapleStory status bar into numbers.
 * Everything here is pure so it can be unit-tested without Tesseract.
 */

export interface ExpReading {
  exp: number
  percent: number
}

export interface NameReading {
  name?: string
  job?: string
}

const digitsOnly = (s: string): string => s.replace(/\D/g, '')

export function parseLevel(text: string): number | undefined {
  const d = digitsOnly(text)
  if (!d || d.length > 3) return undefined
  const n = Number(d)
  return n >= 1 && n <= 300 ? n : undefined
}

/**
 * Parse percentages such as "15.50", "15,50", "9.67" or "1550" (separator lost).
 * MapleStory always prints two decimals.
 */
export function parsePercent(raw: string): number | undefined {
  const cleaned = raw.replace(/\s/g, '')
  const m = cleaned.match(/^(\d{1,3})[.,](\d{1,2})$/)
  let value: number
  if (m) {
    value = Number(`${m[1]}.${m[2].padEnd(2, '0')}`)
  } else {
    const d = digitsOnly(cleaned)
    if (!d || d.length > 5) return undefined
    value = d.length <= 2 ? Number(d) : Number(d) / 100
  }
  return value >= 0 && value < 100.0001 ? value : undefined
}

/**
 * Parse "66.380[15.50%]", "179,334 [9.67%]", "66380 (15.50 %)" ...
 * Thousands separators vary between clients so they're simply stripped.
 */
export function parseExp(text: string): ExpReading | undefined {
  const t = text.replace(/[|{]/g, '[').replace(/[}]/g, ']').replace(/\s+/g, ' ').trim()
  const open = t.search(/[[(]/)
  if (open <= 0) return parseExpWithoutBracket(t)
  const expDigits = expNumber(t.slice(0, open))
  if (!expDigits || expDigits.length > 13) return undefined
  const exp = Number(expDigits)
  const rest = t.slice(open + 1)
  // The game always prints "dd.dd%"; anything after the two decimals (a misread "%", "]") is noise.
  const m = rest.match(/^\s*(\d{1,3})\s*[.,]\s*(\d{2})/)
  const percent = m ? Number(`${m[1]}.${m[2]}`) : parsePercent(rest.replace(/[%\])[].*$/, ''))
  if (percent === undefined || percent > 100) return undefined
  return { exp, percent }
}

/**
 * Digits of the EXP amount. When thousands separators are present the grouping must be valid
 * (every group after the first has exactly 3 digits). A 4-digit last group means the "[" was also
 * read as a digit ("95.7231(" for "95.723["), so that glyph is dropped. Other broken groupings are
 * rejected rather than guessed.
 */
function expNumber(raw: string): string | undefined {
  const s = raw.replace(/[\s']/g, '')
  if (!/[.,]/.test(s)) return digitsOnly(s) || undefined
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) return digitsOnly(s)
  const m = s.match(/^(\d{1,3}(?:[.,]\d{3})+)\d$/)
  return m ? digitsOnly(m[1]) : undefined
}

/**
 * The "[" is sometimes read as "1" ("81.214119.08%"). If the EXP uses thousands separators we can
 * still split it: take the grouped number at the start, skip one junk glyph, read "dd.dd".
 */
function parseExpWithoutBracket(t: string): ExpReading | undefined {
  const m = t.match(/^(\d{1,3}(?:[.,]\d{3})+)\D?\d?(\d{1,2})[.,](\d{2})/)
  if (!m) return undefined
  const percent = Number(`${m[2]}.${m[3]}`)
  return percent <= 100 ? { exp: Number(digitsOnly(m[1])), percent } : undefined
}

const cleanWord =(s: string): string => s.replace(/[^A-Za-z0-9]/g, '')

/** The name box has two lines: job on top, character name below. */
export function parseName(text: string): NameReading {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => cleanWord(l).length >= 2)
  if (lines.length === 0) return {}
  if (lines.length === 1) return { name: cleanWord(lines[0]) }
  const job = lines[0].replace(/[^A-Za-z0-9 ]/g, '').trim()
  return { job: job || undefined, name: cleanWord(lines[lines.length - 1]) }
}

/**
 * Meso amount from a notice line like "You have gained mesos (+52)", or undefined.
 *
 * Only meso lines are used: EXP comes from the status bar (which is authoritative and
 * self-checking), and item drops aren't tracked. The wording may be misread ("gamed mesas"), but
 * the amount must be a clean "(+digits)" — a missing ")" or letters in the number usually means a
 * half-faded line, which is skipped rather than guessed.
 */
export function parseMesoLine(line: string): number | undefined {
  const raw = line.trim()
  if (!/m[e3]s[oa0]s?\b/i.test(raw)) return undefined
  const m = raw.match(/\(\s*\+\s*(\d{1,3}(?:,\d{3})+|\d{1,9})\s*\)/)
  if (!m) return undefined
  const n = Number(digitsOnly(m[1]))
  return n > 0 ? n : undefined
}

/** Normalised form used to compare the same notice line across two OCR passes. */
export function noticeKey(line: string): string {
  return line.toLowerCase().replace(/[^a-z0-9+]/g, '')
}

function similar(a: string, b: string): boolean {
  if (a === b) return true
  // Amounts must match exactly; only the wording may differ by a few characters.
  if (a.replace(/\D/g, '') !== b.replace(/\D/g, '')) return false
  const max = Math.max(a.length, b.length)
  if (max === 0) return true
  return levenshtein(a, b) <= Math.max(1, Math.floor(max * 0.12))
}

export function levenshtein(a: string, b: string): number {
  const prev = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/**
 * Notices scroll upward: new lines are appended at the bottom and old ones fade out at the top.
 * Align the previous OCR pass with the current one (fuzzy LCS) and return the lines that came in
 * after the last line we already knew about.
 */
export function newNoticeLines(previous: string[], current: string[]): string[] {
  const p = previous.map(noticeKey)
  const c = current.map(noticeKey)
  const dp: number[][] = Array.from({ length: p.length + 1 }, () => new Array(c.length + 1).fill(0))
  for (let i = 1; i <= p.length; i++) {
    for (let j = 1; j <= c.length; j++) {
      dp[i][j] = similar(p[i - 1], c[j - 1]) ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  // Walk back to find the index (in current) of the last matched line.
  let i = p.length
  let j = c.length
  let lastMatched = -1
  while (i > 0 && j > 0) {
    if (similar(p[i - 1], c[j - 1]) && dp[i][j] === dp[i - 1][j - 1] + 1) {
      lastMatched = Math.max(lastMatched, j - 1)
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }
  return current.slice(lastMatched + 1)
}
