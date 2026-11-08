import { describe, expect, it } from 'vitest'
import { parseExp, parseLevel, parseName, parsePercent } from './parse'

describe('parseLevel', () => {
  it('reads digits from the orange tiles', () => {
    expect(parseLevel('44')).toBe(44)
    expect(parseLevel(' 6 8 \n')).toBe(68)
    expect(parseLevel('')).toBeUndefined()
    expect(parseLevel('0')).toBeUndefined()
    expect(parseLevel('1234')).toBeUndefined()
    // Classic World caps at 100.
    expect(parseLevel('101')).toBeUndefined()
    expect(parseLevel('100')).toBe(100)
  })
})

describe('parsePercent', () => {
  it('handles both separators and a lost separator', () => {
    expect(parsePercent('15.50')).toBe(15.5)
    expect(parsePercent('15,50')).toBe(15.5)
    expect(parsePercent('9.67')).toBe(9.67)
    expect(parsePercent('1550')).toBe(15.5)
    expect(parsePercent('967')).toBe(9.67)
    expect(parsePercent('100.00')).toBe(100)
  })
})

describe('parseExp', () => {
  it('reads the status bar formats', () => {
    expect(parseExp('66.380[15.50%]')).toEqual({ exp: 66_380, percent: 15.5 })
    expect(parseExp('179,334 [9.67%]')).toEqual({ exp: 179_334, percent: 9.67 })
    expect(parseExp('66380 (15.50 %)')).toEqual({ exp: 66_380, percent: 15.5 })
    expect(parseExp('66.380|15.50%|')).toEqual({ exp: 66_380, percent: 15.5 })
    expect(parseExp('0[0.00%]')).toEqual({ exp: 0, percent: 0 })
    // Real OCR output from the game: "%" misread as "74".
    expect(parseExp('66.380(15.5074]')).toEqual({ exp: 66_380, percent: 15.5 })
    expect(parseExp('66.380[15.50')).toEqual({ exp: 66_380, percent: 15.5 })
    // Live reads from a 4K client: "[" misread as "1", extra digits after the decimals.
    expect(parseExp('81.214119.08%%]')).toEqual({ exp: 81_214, percent: 19.08 })
    expect(parseExp('81.764119.09]')).toEqual({ exp: 81_764, percent: 19.09 })
    expect(parseExp('81.864(19.112%]')).toEqual({ exp: 81_864, percent: 19.11 })
    expect(parseExp('81.964(19.142)')).toEqual({ exp: 81_964, percent: 19.14 })
    // "[" read as "1" *and* a bracket: the 4-digit group gives it away.
    expect(parseExp('95.7231(22.35%)')).toEqual({ exp: 95_723, percent: 22.35 })
    // Broken grouping that can't be explained is rejected, not guessed.
    expect(parseExp('95.72(22.35%)')).toBeUndefined()
    expect(parseExp('1.234.567[50.00%]')).toEqual({ exp: 1_234_567, percent: 50 })
    expect(parseExp('950[0.50%]')).toEqual({ exp: 950, percent: 0.5 })
  })
  it('rejects garbage', () => {
    expect(parseExp('')).toBeUndefined()
    expect(parseExp('66380')).toBeUndefined()
  })
})

describe('parseName', () => {
  it('splits job and name', () => {
    expect(parseName('Assassin\nYnshf\n')).toEqual({ job: 'Assassin', name: 'Ynshf' })
    expect(parseName('misusingtv')).toEqual({ name: 'misusingtv' })
    expect(parseName('')).toEqual({})
  })
})
