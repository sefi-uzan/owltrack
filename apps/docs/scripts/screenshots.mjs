// Captures the docs screenshots from the web app's screenshot mode (`?shot=<name>`, apps/web/src/Shot.tsx),
// which renders the desktop app's real windows against the simulated API.
//
//   npm run dev:web                       (in another terminal)
//   npm run screenshots -w @repo/docs
//
// Needs Microsoft Edge or Google Chrome; set BROWSER to use another Chromium.

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:5173/'
const OUT = join(import.meta.dirname, '../public/screenshots')
const PORT = 9333

/** name -> what to open and do before the capture. */
const SHOTS = [
  { name: 'welcome', shot: 'welcome' },
  { name: 'welcome-back', shot: 'welcome-back' },
  { name: 'calibrate-empty', shot: 'calibrate-empty' },
  { name: 'calibrate', shot: 'settings', tab: 'Calibrate' },
  { name: 'pick-window', shot: 'settings', tab: 'Calibrate', click: 'button:has(svg.lucide-monitor-up)' },
  { name: 'overlay-tab', shot: 'settings', tab: 'Overlay' },
  { name: 'session-tab', shot: 'settings', tab: 'Session' },
  { name: 'overlay', shot: 'overlay' },
  { name: 'overlay-unlocked', shot: 'overlay-unlocked' }
]

const BROWSERS = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
]
const browserPath = BROWSERS.find((p) => p && existsSync(p))
if (!browserPath) throw new Error('No Edge or Chrome found. Set BROWSER to a Chromium executable.')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = mkdtempSync(join(tmpdir(), 'owltrack-shots-'))
const browser = spawn(browserPath, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--hide-scrollbars',
  `--user-data-dir=${profile}`,
  'about:blank'
])

let page
for (let i = 0; i < 60 && !page; i++) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
    page = targets.find((t) => t.type === 'page')
  } catch {
    // Not listening yet.
  }
  if (!page) await sleep(250)
}
if (!page) throw new Error('The browser did not start.')

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let nextId = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data)
  pending.get(msg.id)?.(msg)
  pending.delete(msg.id)
})
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++nextId
    pending.set(id, resolve)
    ws.send(JSON.stringify({ id, method, params }))
  })
const run = async (expression) =>
  (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value

// Radix tabs switch on pointerdown, not click.
const clickTab = (label) =>
  run(`(() => {
    const tab = [...document.querySelectorAll('[role=tab]')].find((t) => t.textContent.includes(${JSON.stringify(label)}))
    tab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    tab.click()
  })()`)

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 800, deviceScaleFactor: 2, mobile: false })
mkdirSync(OUT, { recursive: true })

for (const s of SHOTS) {
  await send('Page.navigate', { url: `${WEB_URL}?shot=${s.shot}` })
  // Let the simulated session tick, the frame load and the OCR previews fill in.
  await sleep(2500)
  if ('tab' in s) {
    await clickTab(s.tab)
    await sleep(1200)
  }
  if ('click' in s) {
    await run(`document.querySelector(${JSON.stringify(s.click)}).click()`)
    await sleep(800)
  }
  const box = await run(`(() => {
    const r = document.querySelector('#shot').getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })()`)
  const res = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { ...box, scale: 1 },
    captureBeyondViewport: true
  })
  writeFileSync(join(OUT, `${s.name}.png`), Buffer.from(res.result.data, 'base64'))
  process.stdout.write(`screenshots/${s.name}.png\n`)
}

ws.close()
browser.kill()
await sleep(1000)
try {
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
} catch {
  // Windows can keep the temp profile locked a while after the browser exits; it's in %TEMP% anyway.
}
process.exit(0)
