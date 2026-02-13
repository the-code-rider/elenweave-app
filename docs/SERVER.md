# Local App Server

This app includes a lightweight Node.js server so you can run the Elenweave demo locally and connect it to your own systems. The server hosts the UI and exposes JSON endpoints for board storage.

## Where it lives

`pages/app/server/index.js`

All server data is stored under:

`pages/app/data/`

## What it does

- Serves the static app from `pages/`
- Provides board APIs (`/api/boards`)
- Persists boards as JSON files on disk

## Running it

From the repo root:

```bash
npm run server
```

Then open:

```
http://127.0.0.1:8787/app/index.html
```

You can change host/port with environment variables:

```bash
HOST=0.0.0.0 PORT=8080 npm run server
```

## Static file routing

The server maps URL paths directly to `pages/`:

- `/app/index.html` → `pages/app/index.html`
- `/app/app.css` → `pages/app/app.css`
- `/app/app.js` → `pages/app/app.js`

The root path `/` redirects to `/app/index.html`.

## Storage format

Boards are stored as JSON files in:

```
pages/app/data/boards/<boardId>.json
```

Board index is stored in:

```
pages/app/data/index.json
```

## API reference

### `GET /api/boards`

Returns the board list:

```json
{ "boards": [{ "id": "...", "name": "...", "createdAt": 0, "updatedAt": 0 }] }
```

### `POST /api/boards`

Create a board:

```json
{ "name": "My board" }
```

### `PATCH /api/boards/:id`

Rename a board:

```json
{ "name": "New name" }
```

### `GET /api/boards/:id`

Load a board:

```json
{ "board": { "id": "...", "name": "...", "nodes": [], "edges": [] } }
```

### `PUT /api/boards/:id`

Save a full board payload:

```json
{ "board": { "id": "...", "nodes": [], "edges": [] } }
```

### `DELETE /api/boards/:id`

Delete a board.

### `POST /api/boards/:id/nodes`

Add nodes and edges:

```json
{
  "nodes": [{ "id": "node-1", "type": "html-text", "data": { "text": "Hello" } }],
  "edges": [{ "id": "edge-1", "source": "node-1", "target": "node-2" }]
}
```

## Notes

- The client automatically switches to server mode when `/api/boards` responds.
- Assets (images/audio/code blobs) are still stored in the browser’s IndexedDB for now.
