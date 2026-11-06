import { describe, expect, it } from 'vitest'
import { newNoticeLines, parseExp, parseLevel, parseName, parseNoticeLine, parsePercent } from './parse'

describe('parseLevel', () => {
  it('reads digits from the orange tiles', () => {
    expect(parseLevel('44')).toBe(44)
    expect(parseLevel(' 6 8 \n')).toBe(68)
    expect(parseLevel('')).toBeUndefined()
    expect(parseLevel('0')).toBeUndefined()
    expect(parseLevel('1234')).toBeUndefined()
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
    expect(parseExp('66.380[15.50%]')).toEqual({ exp: 66380, percent: 15.5 })
    expect(parseExp('179,334 [9.67%]')).toEqual({ exp: 179334, percent: 9.67 })
    expect(parseExp('66380 (15.50 %)')).toEqual({ exp: 66380, percent: 15.5 })
    expect(parseExp('66.380|15.50%|')).toEqual({ exp: 66380, percent: 15.5 })
    expect(parseExp('0[0.00%]')).toEqual({ exp: 0, percent: 0 })
    // Real OCR output from the game: "%" misread as "74".
    expect(parseExp('66.380(15.5074]')).toEqual({ exp: 66380, percent: 15.5 })
    expect(parseExp('66.380[15.50')).toEqual({ exp: 66380, percent: 15.5 })
    // Live reads from a 4K client: "[" misread as "1", extra digits after the decimals.
    expect(parseExp('81.214119.08%%]')).toEqual({ exp: 81214, percent: 19.08 })
    expect(parseExp('81.764119.09]')).toEqual({ exp: 81764, percent: 19.09 })
    expect(parseExp('81.864(19.112%]')).toEqual({ exp: 81864, percent: 19.11 })
    expect(parseExp('81.964(19.142)')).toEqual({ exp: 81964, percent: 19.14 })
    // "[" read as "1" *and* a bracket: the 4-digit group gives it away.
    expect(parseExp('95.7231(22.35%)')).toEqual({ exp: 95723, percent: 22.35 })
    // Broken grouping that can't be explained is rejected, not guessed.
    expect(parseExp('95.72(22.35%)')).toBeUndefined()
    expect(parseExp('1.234.567[50.00%]')).toEqual({ exp: 1234567, percent: 50 })
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

describe('notices', () => {
  it('parses notice lines', () => {
    expect(parseNoticeLine('You received EXP (+41)')).toMatchObject({ kind: 'exp', amount: 41 })
    expect(parseNoticeLine('You have gained mesos (+52)')).toMatchObject({ kind: 'meso', amount: 52 })
    expect(parseNoticeLine('Orange Potion x1 earned. (Use)')).toMatchObject({
      kind: 'item',
      item: 'Orange Potion',
      qty: 1,
      category: 'Use'
    })
    expect(parseNoticeLine('Maple Leaf x1 earned. (Etc)')).toMatchObject({ kind: 'item', item: 'Maple Leaf' })
    expect(parseNoticeLine('Maple Les +1 rarned ‘Et')).toMatchObject({ kind: 'item', item: 'Maple Les', qty: 1 })
    expect(parseNoticeLine('Toul have gamed mesos (+52)')).toMatchObject({ kind: 'meso', amount: 52 })
    expect(parseNoticeLine('~~~')).toBeUndefined()
  })

  it('finds only lines that scrolled in', () => {
    const a = ['You received EXP (+41)', 'Orange Potion x1 earned. (Use)', 'You have gained mesos (+52)']
    const b = ['Orange Potion x1 earned. (Use)', 'You have gained mesos (+52)', 'Maple Leaf x1 earned. (Etc)']
    expect(newNoticeLines(a, b)).toEqual(['Maple Leaf x1 earned. (Etc)'])
    expect(newNoticeLines(b, b)).toEqual([])
    // A line OCR missed in the middle must not cause re-counting.
    expect(newNoticeLines(a, [a[0], a[2]])).toEqual([])
    // Small OCR differences are tolerated.
    expect(newNoticeLines(a, ['Orange Potion xl earned. (Use)', a[2], 'You have gained mesos (+45)'])).toEqual([
      'You have gained mesos (+45)'
    ])
    expect(newNoticeLines([], a)).toEqual(a)
  })
})
