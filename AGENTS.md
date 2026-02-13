# Repository Guidelines

## Project Structure & Module Organization
- `app/` is the client app (`index.html`, `app.js`, `app.css`) plus AI modules (`llm_clients.js`, `realtime_audio.js`, `markdown-block.js`).
- `server/index.js` serves static files and board APIs (`/api/boards`, `/api/boards/:id`, `/api/boards/:id/nodes`).
- `docs/` is the source of truth for behavior and architecture (`APP.md`, `SERVER.md`, `AI_FEATURES.md`, `AI_PROMPT.md`).
- Note: docs still reference legacy `pages/app/...` paths; map those to this repo’s `app/` and `server/`.

## Build, Test, and Development Commands
- No build pipeline is configured; this is plain JavaScript/HTML/CSS.
- Start local server: `node server/index.js`
- PowerShell host/port override: `$env:HOST='0.0.0.0'; $env:PORT='8080'; node server/index.js`
- Open locally: `http://127.0.0.1:8787/app/index.html`
- Quick API check: `curl http://127.0.0.1:8787/api/boards`

## Coding Style & Naming Conventions
- Use ES modules and modern JS (`const`/`let`, `async`/`await`).
- Indentation: 2 spaces; keep semicolons.
- Match existing string style (single quotes in JS).
- Naming: `camelCase` for functions/variables, `UPPER_SNAKE_CASE` for constants, lowercase file names (e.g., `realtime_audio.js`).
- Keep orchestration in `app/app.js`; place provider/audio/markdown concerns in their dedicated modules.
- AI changes must preserve the `ew-actions/v1` JSON plan contract used by prompt/apply flow.

## Testing Guidelines
- No automated test framework is set up yet; validate changes manually.
Minimum manual checks:
1. Start server and load the app.
2. Create, rename, delete, and reload boards (server persistence).
3. Verify `/api/boards` and affected routes for server edits.
4. For AI changes, test follow-up nodes (`TextInput`, `OptionPicker`) and attachment handling.
5. For UI work, test light/dark/blueprint themes.

## Commit & Pull Request Guidelines
- This checkout has no commit history yet; use concise, imperative commit subjects (example: `add board rename validation`).
- Keep commits focused by area (`app`, `server`, or `docs`).
- PRs should include change summary, manual verification steps, linked issue/context, and screenshots for visible UI updates.

## Security & Configuration Tips
- Never commit API keys or tokens; app keys are user-provided and stored locally.
- Review JSON fixtures before committing to avoid leaking sensitive board content.
- Understand storage split: board JSON can be server-backed, while asset blobs remain IndexedDB-backed client-side.
- Keep runtime `data/` artifacts out of code review unless intentionally changed.
