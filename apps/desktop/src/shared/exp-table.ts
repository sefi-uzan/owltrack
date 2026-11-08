/**
 * MapleStory Classic World EXP table: EXP needed to go from `level` to `level + 1`.
 * Source: https://meowdb.com/msclassic/guides/exp-table-level-1-to-100 (updated 2026-10-23).
 * Levels 1-89 match pre-Big-Bang MapleStory; 90-99 grow 2.1x per level. Level 100 is the cap.
 */
const EXP_TO_NEXT: readonly number[] = [
  // 1-10
  15, 34, 57, 92, 135, 372, 560, 840, 1242, 1716,
  // 11-20
  2360, 3216, 4200, 5460, 7050, 8840, 11_040, 13_716, 16_680, 20_216,
  // 21-30
  24_402, 28_980, 34_320, 40_512, 47_216, 54_900, 63_666, 73_080, 83_720, 95_700,
  // 31-40
  108_480, 122_760, 138_666, 155_540, 174_216, 194_832, 216_600, 240_500, 266_682, 294_216,
  // 41-50
  324_240, 356_916, 391_160, 428_280, 468_450, 510_420, 555_680, 604_416, 655_200, 709_716,
  // 51-60
  748_608, 789_631, 832_902, 878_545, 926_689, 977_471, 1_031_036, 1_087_536, 1_147_132, 1_209_994,
  // 61-70
  1_276_301, 1_346_242, 1_420_016, 1_497_832, 1_579_913, 1_666_492, 1_757_815, 1_854_143, 1_955_750, 2_062_925,
  // 71-80
  2_175_973, 2_295_216, 2_420_993, 2_553_663, 2_693_603, 2_841_212, 2_996_910, 3_161_140, 3_334_370, 3_517_093,
  // 81-90
  3_709_829, 3_913_127, 4_127_566, 4_353_756, 4_592_341, 4_844_001, 5_109_452, 5_389_449, 5_684_790, 11_938_059,
  // 91-99
  25_069_923, 52_646_838, 110_558_359, 232_172_553, 487_562_361, 1_023_880_958, 2_150_150_011, 4_515_315_023,
  9_482_161_548
]

export const MAX_LEVEL = 100

/** EXP needed to level up from `level`, or undefined at the cap / for an unknown level. */
export function expToNext(level: number | undefined): number | undefined {
  return level === undefined ? undefined : EXP_TO_NEXT[level - 1]
}

/**
 * Does `exp` at `level` display as `percent`? The game shows two decimals; we accept both a
 * rounded and a truncated percentage, so the true value lies in [percent - 0.005, percent + 0.01).
 */
export function fitsTable(exp: number, percent: number, required: number): boolean {
  if (exp < 0 || exp >= required) return false
  const actual = (exp / required) * 100
  return actual >= percent - 0.005 - 1e-9 && actual < percent + 0.01 + 1e-9
}
