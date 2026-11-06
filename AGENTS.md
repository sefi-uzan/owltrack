# Agent notes

OwlTrack: an always-on-top MapleStory EXP tracker overlay for Windows (Electron). Open source, MIT.

## Workflow

- **We push straight to `master`.** No feature branches or PRs unless asked.
- **Every change that ships must bump the version** in `apps/desktop/package.json`
  ([semver](https://semver.org)):
  - **patch** (`0.1.0` → `0.1.1`): bug fixes, tweaks, internal refactors, CI/tooling.
  - **minor** (`0.1.0` → `0.2.0`): new features or user-visible behaviour changes.
  - **major** (`0.1.0` → `1.0.0`): breaking changes (e.g. settings/calibration data that no longer loads).

  Keep `package-lock.json` in sync (`npm version <patch|minor|major> -w @repo/desktop --no-git-tag-version`).
- CI (`.github/workflows/ci.yml`) runs lint, typecheck and tests, packages the Windows x64 app, and on
  `master` tags `v<version>` and publishes a GitHub release with the installer. If the
  version wasn't bumped, the tag already exists and no release is made.
- Release builds are code-signed through SignPath (two manual approvals per release, see
  `.signpath/README.md`). Don't weaken that flow: SignPath Foundation's terms require binaries built
  from this repo by CI, manual approval, and the "Code signing policy" and "Privacy" sections in the
  README. Keep the product name `OwlTrack` in the exe metadata (it's checked when signing).
- The app must stay offline. Adding any network call means updating the README privacy statement and
  asking the user first (SignPath requires a privacy policy and an opt-out for data transfer).

## Docs and website

- `apps/docs` pages are written in ASD-STE100 Simplified Technical English. Follow
  `apps/docs/STYLE.md` when you add or change a page, and update the docs when user-visible behaviour changes.
- `apps/web` renders the desktop renderer components against a simulated API (`apps/web/src/demo/mock-api.ts`).
  When `Api` changes, update the mock. When the UI changes, regenerate the docs screenshots
  (`npm run dev:web`, then `npm run screenshots -w @repo/docs`).

## Checks

Run before pushing: `npm run check` (Biome), `npm run typecheck`, `npm test`. `npm run fix` auto-fixes lint/format.
