# Public Project Catalog

This document describes the public catalog format used by the in-app Download panel and the
manifest format used to import a project into local storage.

## Runtime config

Set the catalog URL via the server environment:

```bash
ELENWEAVE_PUBLIC_CATALOG_URL=https://example.com/catalog.json npm run server
```

The server injects `publicProjectsCatalogUrl` into `window.__ELENWEAVE_RUNTIME__` when serving
`app/index.html`.

## Catalog JSON

The catalog is a JSON document with a top-level `projects` array.

Example:

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

Fields:

- `id`: unique catalog id for update checks.
- `name`: display name.
- `description`: short summary shown in the download panel.
- `publisher`: display name for the publisher/author.
- `publishedAt`: first publish date (ISO timestamp).
- `updatedAt`: last update date (ISO timestamp).
- `version`: semantic version string for the catalog entry.
- `coverUrl`: optional preview image URL.
- `tags`: optional string tags.
- `manifestUrl`: absolute or relative URL to the manifest JSON.

## Manifest JSON

The manifest is a JSON document describing a single project and its boards/assets.

Example:

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

Boards can be inlined with a `payload` instead of a file:

```json
{
  "name": "Intro board",
  "payload": { "nodes": [], "edges": [], "nodeOrder": [], "notifications": [] }
}
```

Notes:

- `manifestUrl` references in the catalog are resolved relative to the catalog URL.
- Asset and board `file` entries are resolved relative to the manifest URL.
- Remote URLs must be HTTPS (local dev: `http://localhost` / `http://127.0.0.1` allowed).
- Size limits: manifest 2 MB, board JSON 8 MB, asset file 50 MB.
