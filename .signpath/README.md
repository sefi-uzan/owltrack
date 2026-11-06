# SignPath setup

Releases are signed by [SignPath.io](https://signpath.io) with a certificate from the
[SignPath Foundation](https://signpath.org). CI (`.github/workflows/ci.yml`) signs in two stages,
because the installers wrap the app exe and SignPath can't sign inside an NSIS installer:

1. **`app`**: `OwlTrack.exe` is signed, then copied back into `win-unpacked/`.
2. **`installers`**: the NSIS installer and portable exe are built around the signed exe
   (`electron-builder --prepackaged`) and signed.

Each stage is a separate signing request, so a release needs **two approvals** in SignPath.

## One-time setup

1. In SignPath, create a project with slug `owltrack` and link it to the GitHub trusted build system.
2. Add two artifact configurations from the files in `artifact-configurations/`, with slugs `app` and
   `installers`.
3. Use the `release-signing` signing policy (manual approval).
4. Create an API token for a CI user that is allowed to submit to that policy.
5. In the GitHub repo settings:
   - **Variable** `SIGNPATH_ORGANIZATION_ID`: your SignPath organization ID
   - **Secret** `SIGNPATH_API_TOKEN`: the API token

Until `SIGNPATH_ORGANIZATION_ID` is set, CI keeps publishing unsigned releases.
