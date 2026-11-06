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

const digitsOnly = (s: string): string => s.replace(/\D/gu, '')

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
  const cleaned = raw.replace(/\s/gu, '')
  const m = cleaned.match(/^(\d{1,3})[.,](\d{1,2})$/u)
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
  const t = text.replace(/[|{]/gu, '[').replace(/[}]/gu, ']').replace(/\s+/gu, ' ').trim()
  const open = t.search(/[[(]/u)
  if (open <= 0) return parseExpWithoutBracket(t)
  const expDigits = expNumber(t.slice(0, open))
  if (!expDigits || expDigits.length > 13) return undefined
  const exp = Number(expDigits)
  const rest = t.slice(open + 1)
  // The game always prints "dd.dd%"; anything after the two decimals (a misread "%", "]") is noise.
  const m = rest.match(/^\s*(\d{1,3})\s*[.,]\s*(\d{2})/u)
  const percent = m ? Number(`${m[1]}.${m[2]}`) : parsePercent(rest.replace(/[%\])[].*$/u, ''))
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
  const s = raw.replace(/[\s']/gu, '')
  if (!/[.,]/u.test(s)) return digitsOnly(s) || undefined
  if (/^\d{1,3}(?:[.,]\d{3})+$/u.test(s)) return digitsOnly(s)
  const m = s.match(/^(\d{1,3}(?:[.,]\d{3})+)\d$/u)
  return m ? digitsOnly(m[1]) : undefined
}

/**
 * The "[" is sometimes read as "1" ("81.214119.08%"). If the EXP uses thousands separators we can
 * still split it: take the grouped number at the start, skip one junk glyph, read "dd.dd".
 */
function parseExpWithoutBracket(t: string): ExpReading | undefined {
  const m = t.match(/^(\d{1,3}(?:[.,]\d{3})+)\D?\d?(\d{1,2})[.,](\d{2})/u)
  if (!m) return undefined
  const percent = Number(`${m[2]}.${m[3]}`)
  return percent <= 100 ? { exp: Number(digitsOnly(m[1])), percent } : undefined
}

const cleanWord = (s: string): string => s.replace(/[^A-Za-z0-9]/gu, '')

/** The name box has two lines: job on top, character name below. */
export function parseName(text: string): NameReading {
  const lines = text
    .split(/\r?\n/u)
    .map((l) => l.trim())
    .filter((l) => cleanWord(l).length >= 2)
  if (lines.length === 0) return {}
  if (lines.length === 1) return { name: cleanWord(lines[0]) }
  const job = lines[0].replace(/[^A-Za-z0-9 ]/gu, '').trim()
  return { job: job || undefined, name: cleanWord(lines.at(-1)!) }
}
