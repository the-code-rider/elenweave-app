# Handoff Notes (pages/app)

This app is being moved to a new repo and handed to a new coding agent. Below is the critical context.

## Entry points

- `pages/app/index.html`
- `pages/app/app.js`
- `pages/app/app.css`

## Local server

- Server lives at `pages/app/server/index.js`.
- Run with: `npm run server`.
- Serves `pages/` and mounts `/app/index.html`.
- API routes:
  - `GET /api/boards`
  - `POST /api/boards`
  - `PATCH /api/boards/:id`
  - `GET /api/boards/:id`
  - `PUT /api/boards/:id`
  - `DELETE /api/boards/:id`
  - `POST /api/boards/:id/nodes`
- Server data location: `pages/app/data/`.
- Static path guard uses `path.relative` (Windows safe).

## Client storage

Client mode uses IndexedDB:

- DB: `elenweave_assets`
- Store: `workspace` (board index + graph payloads)
- Store: `assets` (blobs)

LocalStorage:

- `elenweave_active_board` (active board id)
- UI prefs (theme, edge style, panel collapse)
- AI provider + model settings + API keys

## AI

- Prompt + follow‑up flow: `pages/app/AI_PROMPT.md`
- AI features list: `pages/app/AI_FEATURES.md`
- LLM helpers: `pages/app/llm_clients.js`
- Realtime audio: `pages/app/realtime_audio.js`
- Markdown output component: `pages/app/markdown-block.js`

## Components

Component catalog: `pages/app/COMPONENTS.md`.

## Large file handling

Large text/code/markdown/csv uploads are stored as assets with previews and a "Load full file" pill.
Preview logic lives in `pages/app/app.js`.

## Known behaviors / potential follow‑ups

- There was a recurring issue where canvas zoom affected the sidebar. A guard was added to prevent wheel/gesture zoom outside the canvas. If it persists, revisit `app.js` wheel handling and any transform side effects.
- Server mode only handles board JSON. Assets remain in IndexedDB.
