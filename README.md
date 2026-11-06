<img src="apps/desktop/assets/icon.svg" width="64" height="64" alt="">

# OwlTrack

[Download](https://github.com/sefi-uzan/owltrack/releases/latest) ·
[Code signing policy](#code-signing-policy) · [Privacy](#privacy) · [License](LICENSE)

An always-on-top overlay for MapleStory that **reads your level, character name and EXP straight
from the game window** and shows EXP gained in the last 5 minutes, EXP/hour, session total and time
to next level.

Electron + TypeScript, React + shadcn/ui (Tailwind v4), bundled with **electron-vite** (Vite 8) and
packaged with **electron-builder** (NSIS installer + portable exe). OCR is Tesseract (WASM, offline).

## Install

Download the latest release from [GitHub Releases](https://github.com/sefi-uzan/owltrack/releases/latest)
(Windows 10/11, x64):

- `OwlTrack-Setup-x.y.z.exe`: installer. Uninstall it from **Settings → Apps → Installed apps**
  (or "Add or remove programs"), like any other app.
- `OwlTrack-Portable-x.y.z.exe`: runs without installing. To remove it, delete the exe.

Settings and learned glyphs live in `%APPDATA%\OwlTrack`; delete that folder to remove them too.

## Using it

1. Run the game **windowed or borderless** (an overlay can't sit on top of exclusive fullscreen).
2. Start OwlTrack. The first time, the settings window opens on the **Calibrate** tab.
3. If it doesn't find the game, type part of its window title or use **Pick window**.
4. Click **Draw** next to each region, then drag a tight box around it on the frame:
   - **EXP numbers**: just `66.380[15.50%]`, without the `EXP` label
   - **Level**: the orange digit tiles
   - **Job + name**: the two lines next to the level
   - **Meso notices** (experimental, off by default): counts "You have gained mesos (+52)" lines.
     Approximate: lines the OCR can't read cleanly are skipped, so it undercounts. EXP is always taken
     from the status bar, never from notices, and item drops aren't tracked.
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
- OCR runs **only when a region's mask changes**, i.e. when the numbers change.
- **EXP is read by a self-learned glyph matcher** (`apps/desktop/src/shared/glyphs.ts`, ~1 ms per read). Whenever
  Tesseract produces a reading that the tracker validated, the image is cut into glyphs and labelled
  with the known digits. After about a minute of grinding all ten digits are known, and from then on
  Tesseract only reads the level, the name, the occasional cross-check (every 100th EXP read) and any
  glyph it isn't sure about. Templates are saved in `glyphs.json` next to the settings.
- The Tesseract worker shuts down after 60 s unused and restarts on demand.
- Capture drops to 2 fps after 20 s without any change (AFK, in town) and goes back to full speed on
  the next change.
- Measured against a 4K MapleStory window: ~3 ms of work per frame. Our own main-process heap is
  ~5 MB; most of the memory (~250 MB main + ~500 MB GPU process) is Electron/Chromium and Windows'
  desktop-capture pipeline.

## Accuracy safeguards

OCR is noisy, so readings are sanity-checked before they count (`apps/desktop/src/shared/tracker.ts`):

- EXP and % must agree on the EXP required for the level, which rejects misread digits.
- The first reading and any drop in EXP have to be seen twice.
- A drop is classified as a **level-up** (level box went up, or the bar emptied) or a **death**
  (counted as a loss).
- Three consistent readings that disagree with the baseline re-baseline it without counting EXP.

## Development

A Turborepo with npm workspaces. Run these from the repo root:

```bash
npm install
npm run dev          # electron-vite dev with HMR
npm test             # parser + tracker unit tests (vitest)
npm run typecheck    # every workspace
npm run check        # Biome lint + format check (Ultracite preset, see biome.jsonc)
npm run fix          # apply Biome's safe fixes and formatting
npm run dist         # apps/desktop/dist/OwlTrack-Setup-x.y.z.exe and a portable exe
npm run icons -w @repo/desktop   # regenerate build/icon.ico, resources/tray.png from assets/icon.svg
```

Set `OWLTRACK_DEBUG=1` to log every OCR pass and per-frame capture timings to the console.

```
apps/desktop        the Electron app (@repo/desktop)
  src/main          Electron main: windows, tray, shortcuts, window discovery, OCR worker, settings
  src/preload       contextBridge API (typed in src/shared/api.ts)
  src/renderer      overlay.html (the HUD), settings.html (shadcn UI + calibrator),
                    capture.html (hidden: video stream → crops → change detection)
  src/shared        pure logic: OCR text parsing, EXP tracker, formatting (unit tested)
packages/ui         shadcn components, cn() and the theme in src/styles/globals.css (@repo/ui)
```

Add shadcn components from the ui package so both the file and its dependencies land there:
`cd packages/ui && npx shadcn@latest add dialog`. (Running it from `apps/desktop` writes the file to
`packages/ui` too, but puts the npm dependencies in the app.) New registry components import `cn`
from shadcn's `cn` package rather than `@repo/ui/lib/utils`.

`packages/ui` exports `./components`, `./lib` and `./hooks` as exact paths besides the `/*`
wildcards. Nothing imports them; they're there for the shadcn CLI, which on Windows resolves
wildcard folder aliases wrong whenever a parent folder name contains a dot (like `.t3`).

Keep `electron` pinned to an exact version in `apps/desktop/package.json`: electron-builder can't
see the hoisted copy in the root `node_modules`, so it needs the version spelled out.

## Contributing

Issues and pull requests are welcome. Run `npm run check`, `npm run typecheck` and `npm test`
before opening a PR.

## Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by
[SignPath Foundation](https://signpath.org).

Only binaries built by this repository's [CI workflow](.github/workflows/ci.yml) from the source in
this repository are signed. Every signing request is approved manually.

Team roles:

- Committers and reviewers: [Sefi Uzan](https://github.com/sefi-uzan)
- Approvers: [Sefi Uzan](https://github.com/sefi-uzan)

Pull requests from outside contributors are reviewed by a committer before they are merged.

## Privacy

This program will not transfer any information to other networked systems unless specifically
requested by the user or the person installing or operating it.

OwlTrack works entirely offline: OCR runs locally (Tesseract, bundled), and settings stay on your PC.

## License

[MIT](LICENSE) © Sefi Uzan.

OwlTrack is a fan-made tool and isn't affiliated with or endorsed by NEXON. MapleStory is a trademark
of NEXON Korea Corporation.
