# Desktop App Auto-Update Plan (R2 + Worker)

## Summary
This document defines a complete plan to add desktop auto-updates for the Electron app.

The update system will:
- check for updates on launch,
- prompt the user before downloading,
- download the installer when approved,
- prompt the user to restart and install when download completes.

Hosting model:
- Cloudflare R2 stores update artifacts.
- A Cloudflare Worker serves update metadata and installers.
- Electron uses the `generic` provider via `electron-updater`.

This is a plan/spec only. Implementation happens later.

## Goals
- Ship Windows desktop updates without requiring manual reinstall steps.
- Keep update UX explicit and safe (prompt-driven, not forced).
- Keep existing local server bootstrap unchanged.
- Keep browser/web runtime unaffected.

## Locked Product Decisions
- Distribution host: Cloudflare R2.
- Update entrypoint: Cloudflare Worker static pass-through.
- Channel strategy: single channel only.
- UX strategy: check on launch, prompt for download/install.
- Target platform for updater: Windows installer builds.

## Out Of Scope
- Stable vs beta split channels.
- macOS/Linux updater support.
- Differential rollout/staged ring deployment.
- Mandatory/forced updates.

## Current Baseline (Already Present)
- Desktop shell exists under `desktop/`.
- Installer is built with `electron-builder` (`nsis`, `x64`).
- Desktop runtime already starts `server/cli.js`, provides IPC bridge, and has a desktop settings panel in the app UI.

Relevant files today:
- `desktop/package.json`
- `desktop/main.js`
- `desktop/preload.js`
- `app/index.html`
- `app/app.js`
- `app/app.css`
- `README.md`

## Target Architecture
1. App boots.
2. Existing bootstrap starts local server and opens renderer.
3. Auto-updater performs update check against Worker URL.
4. If no update exists, state becomes `not-available`.
5. If update exists, user sees prompt:
   - `Download now`
   - `Later`
6. If user downloads:
   - progress is tracked,
   - on completion user sees prompt:
     - `Restart and install`
     - `Later`
7. Install uses updater-managed quit + relaunch install flow.

## Artifact And Hosting Contract

### R2 object layout
Use this exact prefix structure:
- `desktop/win/x64/latest.yml`
- `desktop/win/x64/Elenweave Setup <version>.exe`
- `desktop/win/x64/Elenweave Setup <version>.exe.blockmap`

`latest.yml` must always point to the most recent installer for the channel.

### Worker contract
- Worker handles GET requests under `/desktop/win/x64/*`.
- Worker fetches matching objects from R2.
- Worker returns:
  - `200` with file bytes and correct content type when found,
  - `404` when not found.
- No custom JSON endpoint is required.
- No application-side parsing beyond standard `electron-updater` metadata.

### Feed URL used by app
`https://<worker-domain>/desktop/win/x64`

This URL is configured in Electron builder publish config.

## Desktop Packaging Changes
Update `desktop/package.json`:

1. Add dependency:
- `electron-updater`

2. Add/adjust `build.publish` with generic provider:
- `provider: "generic"`
- `url: "https://<worker-domain>/desktop/win/x64"`

3. Keep current Windows target:
- NSIS x64

4. Ensure build output uploads include:
- installer `.exe`,
- `.blockmap`,
- `latest.yml`.

## Main Process Update Integration
File: `desktop/main.js`

### Additions
- Import and configure updater.
- Maintain updater lifecycle state in memory.
- Register updater event handlers.
- Expose updater controls via IPC.
- Trigger one automatic check at startup after window is shown.

### Updater behavior
- `autoDownload = false` (manual user consent).
- `autoInstallOnAppQuit = false` (explicit install action).
- `allowDowngrade = false`.

### Required events to handle
- `checking-for-update`
- `update-available`
- `update-not-available`
- `download-progress`
- `update-downloaded`
- `error`

### Prompt behavior
- On available update: show dialog with `Download now` / `Later`.
- On downloaded update: show dialog with `Restart and install` / `Later`.

### Non-blocking principle
Any updater failure must not block app usage or local server runtime.

## IPC Contract For Renderer
File: `desktop/preload.js` + handlers in `desktop/main.js`

Expose methods:
- `getUpdateState()`
- `checkForUpdates()`
- `downloadUpdate()`
- `quitAndInstallUpdate()`

### UpdateState shape
```ts
type UpdateState = {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  currentVersion: string;
  availableVersion: string | null;
  progress: { percent: number; transferred: number; total: number } | null;
  lastCheckedAt: string | null; // ISO timestamp
  lastError: string | null;
};
```

## In-App Desktop UI Additions
Files: `app/index.html`, `app/app.js`, `app/app.css`

Add a desktop-only "App Updates" block in the existing desktop settings area:
- Current version label
- Last checked timestamp
- Current update status text
- Action buttons:
  - `Check for updates`
  - `Download update` (visible/enabled when update is available)
  - `Restart to install` (visible/enabled when update is downloaded)

Behavior notes:
- UI is only visible when desktop bridge exists.
- UI reads state from IPC on panel open and after each action.
- Existing settings panel behavior remains unchanged for web/non-desktop mode.

## Security And Reliability Notes
- Update endpoint must be HTTPS.
- Do not log secrets or tokens in updater logs.
- Validate that feed URL is static and controlled.
- If Worker or R2 is unavailable, fail gracefully and keep app usable.

## Logging And Diagnostics
- Add updater lifecycle logging in desktop logs:
  - check start/end,
  - version found,
  - download progress milestones,
  - install trigger,
  - errors with message.
- Keep logs under existing desktop log path.

## Release Workflow (Single Channel)
1. Increase desktop version in `desktop/package.json`.
2. Build Windows installer with existing build command.
3. Collect artifacts from desktop release output:
   - `latest.yml`
   - installer `.exe`
   - `.blockmap`
4. Upload artifacts to R2 prefix `desktop/win/x64/`.
5. Verify Worker serves:
   - `latest.yml` with status 200
   - installer and blockmap with status 200
6. Smoke test update path using an older installed app build.

## Manual Test Plan

### Core scenarios
1. No update available:
   - launch app, check status reaches `not-available`.
2. Update available:
   - launch app, ensure prompt appears.
3. User defers:
   - choose `Later`; app continues unaffected.
4. User downloads:
   - choose `Download now`; confirm progress updates.
5. Download complete:
   - confirm install prompt appears.
6. Install now:
   - choose `Restart and install`; verify update applies.

### Failure scenarios
1. Feed URL unreachable:
   - updater moves to `error`, app still works.
2. Missing or invalid `latest.yml`:
   - updater reports error, app still works.
3. Missing installer object:
   - download fails gracefully with actionable error.

### Regression checks
1. Local server start/stop/restart still works.
2. Desktop config save/restart still works.
3. App loads in all themes.
4. Browser-only app behavior is unchanged.

## Implementation Checklist
- [ ] Add `electron-updater` dependency.
- [ ] Add `build.publish` generic config to desktop builder settings.
- [ ] Implement updater state model in `desktop/main.js`.
- [ ] Implement updater event wiring and prompt dialogs.
- [ ] Add updater IPC handlers.
- [ ] Expose updater APIs in `desktop/preload.js`.
- [ ] Add desktop update controls in app settings UI.
- [ ] Add styling for update section states/buttons.
- [ ] Update `README.md` with desktop auto-update docs.
- [ ] Validate build artifacts and R2 upload script/process.
- [ ] Run full manual test matrix above.

## Assumptions
- First implementation targets Windows only.
- One channel is acceptable for all users.
- Worker domain and R2 bucket are controlled by the project.
- Users may remain on older versions if they choose `Later`.

## Acceptance Criteria
- A new release uploaded to R2 is detected automatically on app launch.
- User can download and install update from within app prompts/UI.
- Update failures do not crash the app or block core usage.
- Existing desktop runtime and local API behavior remain intact.
