/**
 * Self-learning glyph matcher for the status bar's digits.
 *
 * The game draws numbers in a fixed bitmap font, so once we know what each digit looks like we
 * can read them by template matching in well under a millisecond, with no Tesseract. Templates
 * are learned automatically: whenever Tesseract produces a reading that the tracker *validated*,
 * the image is cut into glyphs and labelled with the known digits.
 *
 * Input is the processed OCR image (black text on white) as a grayscale/RGBA bitmap.
 */

export interface Bitmap {
  data: Uint8Array | Uint8ClampedArray
  width: number
  height: number
  /** Bytes per pixel (1 = gray, 4 = RGBA/BGRA). Only the first channel is read. */
  channels: number
}

export interface Glyph {
  x: number
  y: number
  w: number
  h: number
  features: number[]
}

/** Glyph classes: digits, the opening bracket, and "tail" (%, closing bracket). */
export type GlyphClass = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '[' | 'tail'

const GW = 6
const GH = 9
/** A glyph shorter than this fraction of the line height is punctuation (".", ","). */
const SMALL = 0.55
/** Max per-feature mean distance for a confident match. */
export const MATCH_THRESHOLD = 0.12
const MAX_EXEMPLARS = 6

const isInk = (b: Bitmap, x: number, y: number): boolean => b.data[(y * b.width + x) * b.channels] < 128

/** Split the image into glyphs separated by empty columns; returns them left to right. */
export function segment(b: Bitmap): { glyphs: Glyph[]; lineTop: number; lineH: number } {
  const colInk: boolean[] = []
  for (let x = 0; x < b.width; x++) {
    let any = false
    for (let y = 0; y < b.height && !any; y++) any = isInk(b, x, y)
    colInk.push(any)
  }
  const boxes: { x: number; y: number; w: number; h: number }[] = []
  for (let x = 0; x < b.width; ) {
    if (!colInk[x]) {
      x++
      continue
    }
    const x0 = x
    while (x < b.width && colInk[x]) x++
    let top = b.height
    let bottom = -1
    for (let yy = 0; yy < b.height; yy++) {
      for (let xx = x0; xx < x; xx++) {
        if (isInk(b, xx, yy)) {
          if (yy < top) top = yy
          bottom = yy
          break
        }
      }
    }
    // Ignore specks (noise from the threshold).
    if (bottom - top + 1 >= 2 && x - x0 >= 1) boxes.push({ x: x0, y: top, w: x - x0, h: bottom - top + 1 })
  }
  if (boxes.length === 0) return { glyphs: [], lineTop: 0, lineH: 1 }
  const lineTop = Math.min(...boxes.map((g) => g.y))
  const lineH = Math.max(...boxes.map((g) => g.y + g.h)) - lineTop
  const glyphs = boxes.map((g) => ({ ...g, features: features(b, g, lineTop, lineH) }))
  return { glyphs, lineTop, lineH }
}

/** Ink density on a GW×GH grid over the glyph's box, plus its size and vertical position. */
function features(
  b: Bitmap,
  g: { x: number; y: number; w: number; h: number },
  lineTop: number,
  lineH: number
): number[] {
  const out: number[] = []
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const x0 = g.x + Math.floor((gx * g.w) / GW)
      const x1 = Math.max(x0 + 1, g.x + Math.floor(((gx + 1) * g.w) / GW))
      const y0 = g.y + Math.floor((gy * g.h) / GH)
      const y1 = Math.max(y0 + 1, g.y + Math.floor(((gy + 1) * g.h) / GH))
      let ink = 0
      let n = 0
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++, n++) if (isInk(b, x, y)) ink++
      out.push(ink / n)
    }
  }
  // Shape features, weighted so a "1" can't match a "7" just by its strokes.
  out.push((g.h / lineH) * 3, ((g.y - lineTop) / lineH) * 3, (g.w / lineH) * 3)
  return out
}

function distance(a: number[], b: number[]): number {
  let d = 0
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i])
  return d / a.length
}

const isSmall = (g: Glyph, lineH: number): boolean => g.h < lineH * SMALL

export interface TemplateSet {
  /** Keyed by line height in px, since the font scales with the window. */
  [lineHeight: string]: Partial<Record<GlyphClass, number[][]>>
}

const DIGITS: GlyphClass[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

/** "T" for a tall glyph, "s" for a small one; e.g. 66,380[15.50%] -> "TTsTTTTTTsTTTT". */
function layout(glyphs: Glyph[], lineH: number): string {
  return glyphs.map((g) => (isSmall(g, lineH) ? 's' : 'T')).join('')
}

/** Expected layout of the EXP number + "[" + percent, with or without thousands separators. */
function expectedLayouts(exp: number, percent: number): string[] {
  const digits = String(exp)
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/gu, ',')
  const [whole] = percent.toFixed(2).split('.')
  const pct = `T${'T'.repeat(whole.length)}sTT` // "[" + "15" + "." + "50"
  return [grouped.replace(/\d/gu, 'T').replace(/,/gu, 's') + pct, 'T'.repeat(digits.length) + pct]
}

export class GlyphMatcher {
  constructor(public templates: TemplateSet = {}) {}

  private bucket(lineH: number): Partial<Record<GlyphClass, number[][]>> | undefined {
    // Allow ±1px jitter in the line height between frames.
    return this.templates[lineH] ?? this.templates[lineH - 1] ?? this.templates[lineH + 1]
  }

  private add(lineH: number, cls: GlyphClass, f: number[]): boolean {
    const bucket = (this.templates[lineH] ??= {})
    const list = (bucket[cls] ??= [])
    if (list.some((t) => distance(t, f) < 0.01)) return false
    list.push(f)
    if (list.length > MAX_EXEMPLARS) list.shift()
    return true
  }

  /** How many of the 10 digits have templates at this size (matching starts at 10/10). */
  digitsKnown(lineH: number): number {
    const b = this.bucket(lineH) ?? {}
    return DIGITS.filter((d) => b[d]?.length).length
  }

  /** Nearest class, but only if it clearly beats the runner-up class. */
  private classify(g: Glyph, lineH: number): GlyphClass | undefined {
    const bucket = this.bucket(lineH)
    if (!bucket) return undefined
    const perClass: { cls: GlyphClass; d: number }[] = []
    for (const [cls, list] of Object.entries(bucket) as [GlyphClass, number[][]][]) {
      if (list.length) perClass.push({ cls, d: Math.min(...list.map((t) => distance(t, g.features))) })
    }
    perClass.sort((a, b) => a.d - b.d)
    const [best, second] = perClass
    if (!best || best.d > MATCH_THRESHOLD) return undefined
    if (second && best.d > second.d * 0.6) return undefined
    return best.cls
  }

  /**
   * Learn from an EXP image whose true value is known. The glyph layout must match the value
   * exactly (digits, separators, "[", the percent's decimal point) before anything is stored.
   * Returns true if a new template was added.
   */
  learnExp(b: Bitmap, exp: number, percent: number): boolean {
    const { glyphs, lineH } = segment(b)
    const actual = layout(glyphs, lineH)
    const prefix = expectedLayouts(exp, percent).find((p) => new RegExp(`^${p}T{1,3}$`, 'u').test(actual))
    if (!prefix) return false
    const labels = [...String(exp), '[', ...percent.toFixed(2).replace('.', '')] as GlyphClass[]
    let changed = false
    let li = 0
    glyphs.forEach((g, i) => {
      if (actual[i] === 's') return
      const cls = li < labels.length ? labels[li++] : 'tail'
      changed = this.add(lineH, cls, g.features) || changed
    })
    return changed
  }

  /**
   * Read "66.380[15.50%]"-style text. Returns undefined (→ use Tesseract) unless all ten digits
   * have been learned and every glyph matched confidently.
   */
  readExp(b: Bitmap): string | undefined {
    const { glyphs, lineH } = segment(b)
    if (glyphs.length < 4 || this.digitsKnown(lineH) < 10) return undefined
    let out = ''
    for (const g of glyphs) {
      if (isSmall(g, lineH)) {
        out += '.'
        continue
      }
      const cls = this.classify(g, lineH)
      if (!cls) return undefined
      out += cls === 'tail' ? ']' : cls
    }
    // Canonicalise: "66.380[15.50]]" -> "66.380[15.50%]"
    const m = out.match(/^([\d.]+)\[(\d{1,3})\.(\d{2})\]+$/u)
    return m ? `${m[1]}[${m[2]}.${m[3]}%]` : undefined
  }
}
