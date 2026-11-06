import { describe, expect, it } from 'vitest'
import { newNoticeLines, parseExp, parseLevel, parseMesoLine, parseName, parsePercent } from './parse'

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

describe('notices', () => {
  it('reads only meso lines', () => {
    expect(parseMesoLine('You have gained mesos (+52)')).toBe(52)
    expect(parseMesoLine('You have gained mesos (+1,250)')).toBe(1250)
    // Real misreads of the wording from the live game still count...
    expect(parseMesoLine('Toul have gamed mesos (+52)')).toBe(52)
    expect(parseMesoLine('You have gamed mesas (+53)')).toBe(53)
    // ...but a broken amount (half-faded line) is skipped, not guessed.
    expect(parseMesoLine('You have gamed mesos (+hd)')).toBeUndefined()
    expect(parseMesoLine('You have gained mesos (+h 3')).toBeUndefined()
    expect(parseMesoLine('vag received ESF (+5100')).toBeUndefined()
    // EXP and item lines are ignored: EXP comes from the status bar, items aren't tracked.
    expect(parseMesoLine('You received EXP (+50)')).toBeUndefined()
    expect(parseMesoLine('Evil Eye Tail x1 earned. (Etc)')).toBeUndefined()
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
