# App Architecture Overview

This document describes how the app works, what each file does, and how data is stored in client and server modes.

## High-level architecture

The app is an Elenweave workspace with optional local server persistence.

- **UI**: `app/index.html` + `app/app.css`
- **App logic**: `app/app.js`
- **Custom components**: local modules registered into the Elenweave view
- **Storage**: strict runtime mode (`client` IndexedDB-only, or `server` API/file-backed-only)
- **AI**: `app/llm_clients.js`, `app/realtime_audio.js`

## File map

### Core UI

- `app/index.html`
  - App shell markup (projects, boards, tools, input bar, modals).
  - Loads `app.css` and `app.js`.

- `app/app.css`
  - App-specific styling (panel layout, board/project lists, input bar, themes).

### Core logic

- `app/app.js`
  - Boots workspace and view.
  - Registers components (text, forms, charts, media, markdown, SVG, mermaid).
  - Manages **project list**, **board list**, switching, import/export.
  - Handles AI prompt flow, attachments, node creation, and layout.
  - Handles UI state persistence and notifications.
  - Uses `window.__ELENWEAVE_RUNTIME__` to select strict storage mode at boot.

### Custom components

- `app/markdown-block.js`
- `app/svg-block.js`
- `app/mermaid-block.js`

### AI + realtime

- `app/llm_clients.js`
  - OpenAI/Gemini request helpers (text + multimodal), with optional local `/api/ai/*` proxy in server mode.
- `app/realtime_audio.js`
  - Gemini realtime audio session handling.

### Local server

- `server/index.js`
  - Serves static app files.
  - Provides project + board REST APIs.
  - Persists data to shared user-level storage (`~/.elenweave` by default, override with `ELENWEAVE_DATA_DIR`).

## Data storage

### Client mode (IndexedDB)

- DB: `elenweave_assets`
- Stores:
  - `assets`: blob-backed files
  - `workspace`: workspace index + graph payloads

`workspace_index` includes:
- `activeProjectId`
- `activeGraphId`
- `projects[]`
- `boards[]`

### Server mode (file-backed, project scoped)

The app uses project-scoped APIs:

- `/api/projects`
- `/api/projects/:projectId/boards`
- `/api/projects/:projectId/boards/:boardId`
- `/api/projects/:projectId/boards/:boardId/nodes`
- `/api/projects/:projectId/assets`
- `/api/projects/:projectId/assets/:assetId`

In server mode, board/workspace/assets are server source-of-truth only.

Server-side disk layout is documented in `docs/SERVER.md`.

## Runtime flow

1. App boots with `window.__ELENWEAVE_RUNTIME__` (`storageMode: "client" | "server"` plus optional seed read-only flags).
2. In server mode, it loads projects, selects/creates active project, then loads boards for that project.
3. Loads active board payload into the view.
4. User actions mutate graph state; persistence is scheduled.
5. AI actions return plans that add/update nodes and edges.

## AI key resolution

- In client mode, AI keys are browser-local (`localStorage`) as before.
- In server mode, the app checks `/api/ai/providers` and can use server-side keys via `/api/ai/*` without requiring browser-stored API keys.

## Notes

- The app layer does not modify the core Elenweave library.
- Server mode does not fallback to IndexedDB for workspace/boards/assets.
- Client mode does not call server APIs.
- In seeded read-only hosting mode, edit attempts can switch to local fork mode (IndexedDB) while hosted data remains read-only.
