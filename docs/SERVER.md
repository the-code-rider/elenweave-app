# Local App Server

This app includes a lightweight Node.js server that hosts the UI and exposes a project-scoped board API.

## Where it lives

`server/index.js`

## Running it

From repo root:

```bash
npm run server
```

Or via CLI (works well with `npx`):

```bash
npx elenweave-app
```

Open:

```text
http://127.0.0.1:8787/
```

Optional overrides:

```bash
HOST=0.0.0.0 PORT=8080 npm run server
ELENWEAVE_DATA_DIR=/path/to/shared-store npm run server
OPENAI_API_KEY=... GEMINI_API_KEY=... npm run server
ELENWEAVE_EXPERIMENTAL_HAND_CONTROLS=off npm run server
ELENWEAVE_PUBLIC_CATALOG_URL=https://example.com/catalog.json npm run server
```

CLI equivalents:

```bash
npx elenweave-app --mode server --host 0.0.0.0 --port 8080 --data-dir /path/to/shared-store
npx elenweave-app --hand-controls off --hand-model-base-url https://example.com/mediapipe
```

Client-only runtime (browser IndexedDB, API routes disabled):

```bash
npx elenweave-app --mode client
```

AI key config file options:

- `ELENWEAVE_CONFIG=/path/to/config.json` (explicit path)
- `ELENWEAVE_AI_CONFIG=/path/to/config.json` (legacy explicit path)
- `~/.elenweave/config.json` (default location)
- `./config.json` (repo root, auto-detected)
- `./server/config.json` (auto-detected)

Supported `config.json` keys:

- OpenAI key: `openaiApiKey` or `openai.apiKey` or `providers.openai.apiKey`
- Gemini key: `geminiApiKey` / `googleApiKey` or `gemini.apiKey` or `providers.gemini.apiKey`
- OpenAI default model: `openaiModel` or `openai.model` or `providers.openai.model`
- Gemini default model: `geminiModel` or `gemini.model` or `providers.gemini.model`
- OpenAI default-model aliases: `openaiDefaultModel`, `openai.defaultModel`, `providers.openai.defaultModel`
- Gemini default-model aliases: `geminiDefaultModel`, `gemini.defaultModel`, `providers.gemini.defaultModel`

Model env overrides:

- `ELENWEAVE_OPENAI_MODEL` (alias: `ELENWEAVE_OPENAI_DEFAULT_MODEL`)
- `ELENWEAVE_GEMINI_MODEL` (alias: `ELENWEAVE_GEMINI_DEFAULT_MODEL`)

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

## Seeded hosted data (projects + boards + assets)

Use prepackaged data as startup seed.

### Native snapshot seed (recommended)

Point to a folder that already matches server storage layout:

```bash
ELENWEAVE_SEED_DIR=/path/to/seed npm run server
```

or

```bash
npx elenweave-app --mode server --seed-dir /path/to/seed
```

### Portable JSON seed

```bash
ELENWEAVE_SEED_JSON=/path/to/seed.json npm run server
```

or

```bash
npx elenweave-app --mode server --seed-json /path/to/seed.json
```

### Seed application policy

- `ELENWEAVE_SEED_POLICY=first-run` (default): apply only when data root is empty.
- `ELENWEAVE_SEED_POLICY=always`: replace current data on every startup.
- `ELENWEAVE_SEED_POLICY=versioned`: apply when `ELENWEAVE_SEED_VERSION` changes.

### Read-only seeded content

- `ELENWEAVE_SEED_READONLY=off|all|projects`
- `ELENWEAVE_READONLY_FORK=off|local`

When read-only mode is active and fork mode is `local`, browser edits switch to local IndexedDB fork mode while hosted seed data remains immutable.

Native seed folders may include optional `seed.config.json` with read-only defaults and version metadata.

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

### Public projects (download/import)

- `POST /api/public-projects/import` (server mode only)

Body:

```json
{
  "manifestUrl": "https://example.com/project-manifest.json",
  "catalogId": "catalog-project-id",
  "rename": "Optional display name",
  "baseProjectId": "Optional local project id to supersede"
}
```

Notes:

- Remote downloads require HTTPS URLs (except `http://localhost` and `http://127.0.0.1` for local dev).
- Files are size-limited (manifest 2 MB, boards 8 MB, assets 50 MB).
- Imported assets are copied into the local project store and remapped in node payloads.

## Public catalog + manifest schema

Catalog JSON example:

```json
{
  "projects": [
    {
      "id": "catalog-project-id",
      "name": "Project name",
      "description": "Short description",
      "publisher": "Publisher name",
      "publishedAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-10T00:00:00Z",
      "version": "1.0.0",
      "coverUrl": "https://example.com/cover.png",
      "tags": ["tag-a", "tag-b"],
      "manifestUrl": "https://example.com/project-manifest.json"
    }
  ]
}
```

Manifest JSON example:

```json
{
  "id": "catalog-project-id",
  "name": "Project name",
  "description": "Short description",
  "publisher": "Publisher name",
  "publishedAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-10T00:00:00Z",
  "version": "1.0.0",
  "coverUrl": "https://example.com/cover.png",
  "tags": ["tag-a", "tag-b"],
  "assets": [
    { "id": "asset-1", "name": "logo", "mimeType": "image/png", "file": "assets/logo.png" }
  ],
  "boards": [
    { "name": "Intro board", "file": "boards/intro.json" }
  ]
}
```

Boards can be inlined:

```json
{
  "name": "Intro board",
  "payload": { "nodes": [], "edges": [], "nodeOrder": [], "notifications": [] }
}
```

### Local AI proxy (server-side keys)

- `GET /api/ai/providers`
- `POST /api/ai/openai/responses`
- `POST /api/ai/openai/transcriptions`
- `POST /api/ai/gemini/generateContent`

`GET /api/ai/providers` returns provider availability and server-default model hints:

```json
{
  "providers": ["openai", "gemini"],
  "defaultModels": {
    "openai": "gpt-5-mini",
    "gemini": "gemini-3-flash-preview"
  }
}
```

## Notes

- When serving `app/index.html`, the server injects runtime config with `storageMode` from `ELENWEAVE_RUNTIME_MODE` (`server` by default).
- Hand controls runtime flags:
  - `ELENWEAVE_EXPERIMENTAL_HAND_CONTROLS=on|off`
  - `ELENWEAVE_HAND_CONTROLS_MODEL_BASE_URL=<url>` (base URL containing `hand_landmarker.task`)
- Board and project IDs use 16-character URL-safe IDs.
- The server uses lock files + atomic writes for multi-process safety.
- In server mode, boards and assets are file-backed source-of-truth.
- If OpenAI/Gemini keys are configured on the server, browser AI requests can be proxied through local `/api/ai/*` routes instead of calling provider APIs directly from the browser.
