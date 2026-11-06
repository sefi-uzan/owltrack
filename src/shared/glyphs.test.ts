import { describe, expect, it } from 'vitest'
import { GlyphMatcher, segment, type Bitmap } from './glyphs'

// A 3x5 pixel font, rendered the way the OCR image looks: black ink on white, upscaled 3x.
const FONT: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  '.': ['.', '.', '.', '.', '#'],
  '[': ['##', '#.', '#.', '#.', '##'],
  ']': ['##', '.#', '.#', '.#', '##'],
  '%': ['#..#', '..#.', '.#..', '#...', '#..#']
}

function render(text: string, scale = 3): Bitmap {
  const pad = 4
  const cols: string[][] = [] // column-major, 5 rows each
  for (const ch of text) {
    const g = FONT[ch]
    for (let x = 0; x < g[0].length; x++) cols.push(g.map((row) => row[x]))
    cols.push(['.', '.', '.', '.', '.']) // 1px gap
  }
  const width = (cols.length + pad * 2) * scale
  const height = (5 + pad * 2) * scale
  const data = new Uint8Array(width * height).fill(255)
  cols.forEach((col, cx) =>
    col.forEach((v, cy) => {
      if (v !== '#') return
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) data[((cy + pad) * scale + dy) * width + (cx + pad) * scale + dx] = 0
    })
  )
  return { data, width, height, channels: 1 }
}

describe('segment', () => {
  it('splits glyphs on empty columns', () => {
    const { glyphs } = segment(render('66.380'))
    expect(glyphs).toHaveLength(6)
  })
})

describe('GlyphMatcher', () => {
  it('reads nothing until it has learned', () => {
    expect(new GlyphMatcher().readExp(render('66.380[15.50%]'))).toBeUndefined()
  })

  it('learns from validated readings and then reads on its own', () => {
    const m = new GlyphMatcher()
    expect(m.learnExp(render('66.380[15.50%]'), 66380, 15.5)).toBe(true)
    expect(m.learnExp(render('72.941[29.17%]'), 72941, 29.17)).toBe(true)
    // Every digit 0-9 has now been seen.
    expect(m.readExp(render('98.765[43.21%]'))).toBe('98.765[43.21%]')
    expect(m.readExp(render('1.234.567[50.00%]'))).toBe('1.234.567[50.00%]')
  })

  it('refuses to guess a digit it has never seen', () => {
    const m = new GlyphMatcher()
    m.learnExp(render('11.111[11.11%]'), 11111, 11.11)
    expect(m.readExp(render('11.181[11.11%]'))).toBeUndefined()
  })

  it('skips learning when the glyph count does not fit the value', () => {
    const m = new GlyphMatcher()
    expect(m.learnExp(render('66.380[15.50%]'), 6638, 15.5)).toBe(false)
  })

  it('round-trips templates through JSON', () => {
    const m = new GlyphMatcher()
    m.learnExp(render('66.380[15.50%]'), 66380, 15.5)
    m.learnExp(render('72.941[29.17%]'), 72941, 29.17)
    const copy = new GlyphMatcher(JSON.parse(JSON.stringify(m.templates)))
    expect(copy.readExp(render('98.765[43.21%]'))).toBe('98.765[43.21%]')
  })

  it('waits until all ten digits are known', () => {
    const m = new GlyphMatcher()
    m.learnExp(render('66.380[15.50%]'), 66380, 15.5) // 0 1 3 5 6 8 only
    expect(m.readExp(render('66.380[15.50%]'))).toBeUndefined()
  })
})
