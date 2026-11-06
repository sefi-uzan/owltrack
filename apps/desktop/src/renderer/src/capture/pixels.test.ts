import { describe, expect, it } from 'vitest'
import { textBounds } from './pixels'

function image(w: number, h: number, black: [number, number][]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4).fill(255)
  for (const [x, y] of black) d.fill(0, (y * w + x) * 4, (y * w + x) * 4 + 3)
  return d
}

describe('textBounds', () => {
  it('boxes all black pixels', () => {
    expect(
      textBounds(
        image(10, 6, [
          [2, 1],
          [7, 4],
          [3, 3]
        ]),
        10,
        6
      )
    ).toEqual({ x: 2, y: 1, w: 6, h: 4 })
  })

  it('is undefined for a blank image', () => {
    expect(textBounds(image(4, 4, []), 4, 4)).toBeUndefined()
  })
})
