# Local App Server

This app includes a lightweight Node.js server that hosts the UI and exposes a project-scoped board API.

## Where it lives

`server/index.js`

## Running it

From repo root:

```bash
npm run server
```

Open:

```text
http://127.0.0.1:8787/
```

Optional overrides:

```bash
HOST=0.0.0.0 PORT=8080 npm run server
ELENWEAVE_DATA_DIR=/path/to/shared-store npm run server
```

## Storage location

Default data root is shared per user:

- Windows: `%USERPROFILE%\\.elenweave`
- macOS/Linux: `~/.elenweave`

Override with `ELENWEAVE_DATA_DIR`.

Layout:

```text
<root>/
  index.json
  locks/
  projects/
    <projectId>/
      project.json
      assets.json
      boards/
        <boardId>.json
      assets/
        <assetId>.<ext>
```

## API reference

### Projects

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `PATCH /api/projects/:projectId`
- `DELETE /api/projects/:projectId`

### Boards (project scoped)

- `GET /api/projects/:projectId/boards`
- `POST /api/projects/:projectId/boards`
- `GET /api/projects/:projectId/boards/:boardId`
- `PATCH /api/projects/:projectId/boards/:boardId`
- `PUT /api/projects/:projectId/boards/:boardId`
- `DELETE /api/projects/:projectId/boards/:boardId`
- `POST /api/projects/:projectId/boards/:boardId/nodes`

### Assets (project scoped)

- `POST /api/projects/:projectId/assets` (JSON body: `filename`, `mimeType`, `base64`, optional `category`)
- `GET /api/projects/:projectId/assets/:assetId`
- `DELETE /api/projects/:projectId/assets/:assetId`

## Notes

- When serving `app/index.html`, the server injects `window.__ELENWEAVE_RUNTIME__ = { storageMode: "server", serverBase: "" }`.
- Board and project IDs use 16-character URL-safe IDs.
- The server uses lock files + atomic writes for multi-process safety.
- In server mode, boards and assets are file-backed source-of-truth.
