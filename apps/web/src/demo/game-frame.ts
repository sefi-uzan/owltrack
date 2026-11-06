import type { Rect } from '@shared/types'

/** Size of the fake game window the demo "captures". */
export const FRAME = { width: 1600, height: 900 }

const px = (x: number, y: number, w: number, h: number): Rect => ({
  x: x / FRAME.width,
  y: y / FRAME.height,
  w: w / FRAME.width,
  h: h / FRAME.height
})

/** Calibrated regions that line up with the status bar drawn by `gameFrame()`. */
export const DEMO_REGIONS = {
  level: px(66, 851, 84, 38),
  name: px(166, 846, 150, 48),
  exp: px(818, 853, 300, 34)
}

export interface FrameState {
  level: number
  job: string
  name: string
  exp: number
  percent: number
}

const svgUrl = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

const FONT = 'Segoe UI, Arial, sans-serif'

/**
 * A stylised, made-up game scene with a status bar at the bottom. Not a copy of any real game UI,
 * just enough for the calibrator demo to have something to draw boxes on.
 */
export function gameFrame(s: FrameState): string {
  const digits = String(s.level).split('')
  const tiles = digits
    .map(
      (d, i) =>
        `<rect x="${70 + i * 27}" y="855" width="23" height="30" rx="4" fill="#f08a1c"/>` +
        `<text x="${81.5 + i * 27}" y="877" font-size="20" font-weight="900" fill="#fff" text-anchor="middle">${d}</text>`
    )
    .join('')
  const bar = Math.max(0, Math.min(100, s.percent)) / 100

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME.width}" height="${FRAME.height}" viewBox="0 0 ${FRAME.width} ${FRAME.height}" font-family="${FONT}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3b5d9c"/><stop offset="0.55" stop-color="#8fb7e6"/><stop offset="1" stop-color="#f4d9a8"/>
    </linearGradient>
    <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c8f25a"/><stop offset="0.5" stop-color="#98d42a"/><stop offset="1" stop-color="#6fae16"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="840" fill="url(#sky)"/>
  <circle cx="1310" cy="150" r="70" fill="#fff6d5" opacity="0.85"/>
  <path d="M0 640 Q 220 520 460 610 T 960 590 T 1600 560 V 840 H 0 Z" fill="#5f8f5a"/>
  <path d="M0 720 Q 300 650 640 720 T 1600 690 V 840 H 0 Z" fill="#3f6b45"/>
  <g fill="#7a5233">
    <rect x="120" y="470" width="360" height="26" rx="6"/><rect x="620" y="380" width="420" height="26" rx="6"/>
    <rect x="1140" y="470" width="340" height="26" rx="6"/>
  </g>
  <g fill="#7bc95b"><rect x="120" y="464" width="360" height="10" rx="5"/><rect x="620" y="374" width="420" height="10" rx="5"/>
    <rect x="1140" y="464" width="340" height="10" rx="5"/></g>
  <g>
    <ellipse cx="260" cy="446" rx="34" ry="22" fill="#f2a65a"/><ellipse cx="380" cy="448" rx="30" ry="19" fill="#f2a65a"/>
    <ellipse cx="760" cy="356" rx="34" ry="22" fill="#9b7fd8"/><ellipse cx="900" cy="358" rx="30" ry="19" fill="#9b7fd8"/>
    <ellipse cx="1260" cy="446" rx="34" ry="22" fill="#5ab0d8"/>
  </g>
  <g fill="#222"><circle cx="250" cy="440" r="3"/><circle cx="268" cy="440" r="3"/><circle cx="752" cy="350" r="3"/>
    <circle cx="770" cy="350" r="3"/><circle cx="1252" cy="440" r="3"/><circle cx="1270" cy="440" r="3"/></g>
  <g transform="translate(560 650)">
    <rect x="-16" y="-58" width="32" height="44" rx="10" fill="#4a6fd1"/><circle cy="-74" r="18" fill="#ffd9b0"/>
    <path d="M-20 -84 Q 0 -110 20 -84 Z" fill="#6b3f1f"/><rect x="-14" y="-16" width="10" height="20" fill="#333"/>
    <rect x="4" y="-16" width="10" height="20" fill="#333"/>
  </g>
  <rect y="840" width="1600" height="60" fill="#1b1f2b"/>
  <rect y="840" width="1600" height="2" fill="#3a4258"/>
  <text x="24" y="878" font-size="19" font-weight="900" font-style="italic" fill="#fff">LV.</text>
  ${tiles}
  <text x="170" y="866" font-size="15" fill="#c9d2e3">${s.job}</text>
  <text x="170" y="888" font-size="17" font-weight="700" fill="#fff">${s.name}</text>
  <rect x="340" y="852" width="1240" height="36" rx="8" fill="#0d1018"/>
  <rect x="340" y="852" width="${Math.round(1240 * bar)}" height="36" rx="8" fill="url(#exp)"/>
  <text x="806" y="878" font-size="20" font-weight="900" font-style="italic" fill="#ffe36b" text-anchor="end">EXP</text>
  <text x="822" y="878" font-size="20" font-weight="700" fill="#fff" stroke="#000" stroke-width="0.5">${s.exp}[${s.percent.toFixed(2)}%]</text>
</svg>`
  return svgUrl(svg)
}

/** The black-on-white mask the calibrator shows as "what the OCR saw". */
export function ocrMask(text: string): string {
  const lines = text.split('\n')
  const height = 14 + lines.length * 26
  const width = 30 + Math.max(...lines.map((l) => l.length)) * 13
  const body = lines
    .map((l, i) => `<text x="10" y="${30 + i * 26}" font-size="22" font-weight="700">${l}</text>`)
    .join('')
  return svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="${FONT}"><rect width="100%" height="100%" fill="#fff"/>${body}</svg>`
  )
}
