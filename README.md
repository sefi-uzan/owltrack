<img src="assets/icon.svg" width="64" height="64" alt="">

# exp-tracker

An always-on-top overlay for MapleStory that **reads your level, character name and EXP straight
from the game window** and shows EXP gained in the last 5 minutes, EXP/hour, session total and time
to next level.

Electron + TypeScript, React + shadcn/ui (Tailwind v4), bundled with **electron-vite** (Vite 8) and
packaged with **electron-builder** (NSIS installer + portable exe). OCR is Tesseract (WASM, offline).

## Using it

1. Run the game **windowed or borderless** (an overlay can't sit on top of exclusive fullscreen).
2. Start EXP Tracker. The first time, the settings window opens on the **Calibrate** tab.
3. If it doesn't find the game, type part of its window title or use **Pick window**.
4. Click **Draw** next to each region, then drag a tight box around it on the frame:
   - **EXP numbers**: just `66.380[15.50%]`, without the `EXP` label
   - **Level**: the orange digit tiles
   - **Job + name**: the two lines next to the level
   - **Drop / meso notices** (experimental, off by default)
5. Each region shows exactly what the OCR sees and what was parsed. Nudge the threshold until the text
   is crisp black on white.

| Shortcut       | Action                                                        |
| -------------- | ------------------------------------------------------------- |
| `Ctrl+Shift+L` | Lock/unlock the overlay (locked = click-through; unlock to drag it) |
| `Ctrl+Shift+H` | Show/hide the overlay                                         |

The tray icon has the same toggles, plus **Settings & calibration** and **Reset session**.

## How it stays cheap

- The game window is streamed with Windows Graphics Capture (via Chromium's desktop capture) at a
  few fps and capped at 1440p. Your overlay is never part of the picture.
- Every frame, only the calibrated regions are copied (GPU-side, into one small atlas) and read back
  once. Each region becomes a 1-bit "text mask".
- OCR runs **only when a region's mask changes**, i.e. when the numbers change. A read takes
  roughly 5–30 ms on a single background Tesseract worker.
- Measured against a 4K MapleStory window: ~4–6 ms of work per frame, and about 3% of one CPU core
  overall with EXP/level/name enabled (around 9% with notices enabled).

## Accuracy safeguards

OCR is noisy, so readings are sanity-checked before they count (`src/shared/tracker.ts`):

- EXP and % must agree on the EXP required for the level, which rejects misread digits.
- The first reading and any drop in EXP have to be seen twice.
- A drop is classified as a **level-up** (level box went up, or the bar emptied) or a **death**
  (counted as a loss).
- Three consistent readings that disagree with the baseline re-baseline it without counting EXP.

## Development

```bash
npm install
npm run dev          # electron-vite dev with HMR
npm test             # parser + tracker unit tests (vitest)
npm run typecheck
npm run dist         # dist/EXP Tracker-Setup-x.y.z.exe and a portable exe
npm run icons        # regenerate build/icon.ico, resources/tray.png from assets/icon.svg
```

Set `EXP_TRACKER_DEBUG=1` to log every OCR pass and per-frame capture timings to the console.

```
src/main       Electron main: windows, tray, shortcuts, window discovery, OCR worker, settings
src/preload    contextBridge API (typed in src/shared/api.ts)
src/renderer   overlay.html (the HUD), settings.html (shadcn UI + calibrator),
               capture.html (hidden: video stream → crops → change detection)
src/shared     pure logic: OCR text parsing, EXP tracker, formatting (unit tested)
```
