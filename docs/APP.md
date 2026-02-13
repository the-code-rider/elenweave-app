# App Architecture Overview

This document describes how the `pages/app` demo works, what each file does, and how data is stored.

## High-level architecture

The app is a client-only Elenweave workspace with optional local server support.

- **UI**: `pages/app/index.html` + `pages/app/app.css`
- **App logic**: `pages/app/app.js`
- **Custom components**: local modules registered into the Elenweave view
- **Storage**: IndexedDB (client mode) or file-backed storage (server mode)
- **AI**: `pages/app/llm_clients.js`, `pages/app/realtime_audio.js`

## File map

### Core UI

- `pages/app/index.html`
  - App shell markup, sidebar, input bar, modals.
  - Loads `app.css` and `app.js`.

- `pages/app/app.css`
  - App-specific styling (layout, sidebar, input bar, buttons, light/dark/blueprint themes).

### Core logic

- `pages/app/app.js`
  - Boots the Elenweave workspace and view.
  - Registers components (text, inputs, charts, media, markdown).
  - Manages board list, board switching, import/export.
  - Handles AI prompts, attachments, node creation, and layout.
  - Handles notifications and UI state persistence.
  - Implements server-mode adapter (auto switches to `/api/boards` when present).

### Custom components

- `pages/app/markdown-block.js`
  - App-only markdown renderer component used for AI output.
- `pages/app/svg-block.js`
  - App-only SVG renderer component.
- `pages/app/mermaid-block.js`
  - App-only Mermaid renderer component.

### AI + realtime

- `pages/app/llm_clients.js`
  - LLM call helpers for OpenAI + Gemini.
  - Supports text + multimodal requests.

- `pages/app/realtime_audio.js`
  - Gemini realtime audio connection and tool-call handling.

### Local server

- `pages/app/server/index.js`
  - Serves `/app/index.html` and assets from `pages/`.
  - Provides REST endpoints for boards.
  - Persists boards to disk under `pages/app/data`.

### Docs

- `pages/app/AI_FEATURES.md`
  - Summary of AI-related features in this app.
- `pages/app/SERVER.md`
  - How the local server works and how to run it.

## Data storage (client mode)

Client mode uses IndexedDB:

- **Database**: `elenweave_assets`
- **Stores**:
  - `assets`: blobs for image/audio/video/text files
  - `workspace`: board index + graph payloads

Key records:

- `workspace` store:
  - `workspace_index`:
    - `{ boards: [{ id, name, updatedAt }], activeGraphId }`
  - `graph_<id>`:
    - full board payload: nodes, edges, meta, notifications

- `assets` store:
  - `{ id, name, type, category, blob, createdAt }`

Other persistence:

- `localStorage`:
  - UI state (theme, edge style, panel collapse)
  - AI provider + model choice
  - API keys (per provider)
  - active board id (used by server mode)

Board metadata:

- `graph.meta` stores AI history and board-level settings.
- `notifications` live inside each board payload.

## Data storage (server mode)

Server mode stores board data on disk:

```
pages/app/data/
  boards/<boardId>.json
  index.json
```

The client auto-detects the server via `/api/boards` and switches
board load/save/rename to the API. Assets still stay in IndexedDB for now.

## Runtime flow

1) App boots and restores board list.
2) Loads the active board and renders it into the view.
3) User actions update the view; persistence is scheduled.
4) AI actions generate node plans and add nodes/edges to the board.

## Notes

- The demo is app-only. It does not modify the core Elenweave library.
- The server is optional. If not running, the app uses IndexedDB.
