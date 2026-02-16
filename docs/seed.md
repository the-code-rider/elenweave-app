# Seed Data Guide

This document explains how Elenweave seed data works for hosted deployments, including:

- bootstrap behavior
- supported seed formats
- how to add projects and boards
- read-only and fork modes

This guide applies to the local Node server in `server/index.js`.

## What seed data is

Seed data is a prepackaged dataset loaded into server storage so users start with ready-made projects and boards (for example, a project containing all team docs mapped onto boards).

Seeded content is loaded into the server data root (`ELENWEAVE_DATA_DIR`) before requests are served.

## How modes work together

There are three mode layers that affect behavior:

1. Storage mode (`storageMode` runtime):
   - `server`: app uses server files/APIs as source of truth.
   - `client`: app uses browser IndexedDB as source of truth.
   - Seed bootstrap is server-side only, so it applies only when running the Node server.
2. Seed apply policy (`ELENWEAVE_SEED_POLICY`):
   - Controls when seed files are copied/materialized into the server data directory.
   - Values: `first-run`, `always`, `versioned`.
3. Seed read-only mode (`ELENWEAVE_SEED_READONLY` + `ELENWEAVE_READONLY_FORK`):
   - Controls whether seeded projects can be modified after bootstrap.
   - Values: `off`, `all`, `projects`, with optional `fork=local|off`.

## How to provide seed data

You can provide one of the following:

1. Native snapshot directory (recommended)
2. Portable JSON bundle

Use either env vars or CLI flags (`npx elenweave-app ...` or `node server/cli.js ...`).

Env vars:

- `ELENWEAVE_SEED_DIR=/path/to/seed`
- `ELENWEAVE_SEED_JSON=/path/to/seed.json`

CLI:

- `npx elenweave-app --mode server --seed-dir /path/to/seed`
- `npx elenweave-app --mode server --seed-json /path/to/seed.json`
- `node server/cli.js --mode server --seed-dir /path/to/seed`
- `node server/cli.js --mode server --seed-json /path/to/seed.json`

Do not set both `seed-dir` and `seed-json` at the same time.

## Seed apply policies

Configure with `ELENWEAVE_SEED_POLICY` or `--seed-policy`.

- `first-run` (default)
  - Applies seed only when current data root has no projects.
  - Never overwrites existing user data.
- `always`
  - Replaces current data on every server start.
  - Use with caution.
- `versioned`
  - Applies when version changes (compare against stored seed state).
  - Pair with `ELENWEAVE_SEED_VERSION` or `--seed-version`.

Server writes seed state to:

- `<dataRoot>/.seed-state.json`

## Seed formats

## 1) Native snapshot format (recommended)

Directory structure:

```text
<seedDir>/
  index.json
  seed.config.json (optional)
  projects/
    <projectId>/
      project.json
      assets.json
      boards/
        <boardId>.json
      assets/
        <assetId>.<ext>
```

Notes:

- IDs must match server ID constraints (`[A-Za-z0-9_-]`, length 8-64).
- `index.json` should list projects.
- `project.json` should list board summaries.
- `boards/<boardId>.json` contains full board payload (nodes/edges/etc).
- `assets.json` references files present in `assets/`.

Minimal `index.json` example:

```json
{
  "projects": [
    {
      "id": "proj_docs_0001",
      "name": "Docs Project",
      "createdAt": 1735689600000,
      "updatedAt": 1735689600000
    }
  ]
}
```

Minimal `projects/proj_docs_0001/project.json`:

```json
{
  "id": "proj_docs_0001",
  "name": "Docs Project",
  "createdAt": 1735689600000,
  "updatedAt": 1735689600000,
  "boards": [
    {
      "id": "board_docs_0001",
      "name": "API Docs",
      "createdAt": 1735689600000,
      "updatedAt": 1735689600000
    }
  ]
}
```

Minimal `projects/proj_docs_0001/boards/board_docs_0001.json`:

```json
{
  "id": "board_docs_0001",
  "name": "API Docs",
  "createdAt": 1735689600000,
  "updatedAt": 1735689600000,
  "meta": null,
  "nodeOrder": [],
  "nodes": [],
  "edges": [],
  "notifications": []
}
```

`seed.config.json` (optional) example:

```json
{
  "seedVersion": "2026.02.16",
  "readOnly": {
    "mode": "projects",
    "projectIds": ["proj_docs_0001"]
  },
  "readOnlyFork": "local"
}
```

## 2) Portable JSON format

Portable JSON is a single file that the server materializes into native layout.

Top-level example:

```json
{
  "seedVersion": "2026.02.16",
  "readOnly": {
    "mode": "projects",
    "projectIds": ["proj_docs_0001"]
  },
  "projects": [
    {
      "id": "proj_docs_0001",
      "name": "Docs Project",
      "createdAt": 1735689600000,
      "updatedAt": 1735689600000,
      "boards": [
        {
          "id": "board_docs_0001",
          "name": "API Docs",
          "createdAt": 1735689600000,
          "updatedAt": 1735689600000,
          "meta": null,
          "nodeOrder": [],
          "nodes": [],
          "edges": [],
          "notifications": []
        }
      ],
      "assets": [
        {
          "id": "asset_docs_0001",
          "name": "spec.md",
          "mimeType": "text/markdown",
          "category": "text",
          "base64": "IyBBUEkgU3BlYwoKLi4u"
        }
      ]
    }
  ]
}
```

Notes:

- `assets[].base64` is required for portable asset import.
- If IDs are invalid/duplicated, server may regenerate IDs during import.
- For strict reproducibility, use valid unique IDs.

## How to add new projects and boards (examples)

## A) Native snapshot: add a new project

1. Add project row to `index.json`.
2. Create `projects/<projectId>/project.json`.
3. Create `projects/<projectId>/assets.json` (usually `{ "assets": [] }` initially).
4. Create `projects/<projectId>/boards/<boardId>.json` for each board.
5. Add board summary rows in `project.json.boards`.

## B) Native snapshot: add a new board to existing project

1. Create board file:
   - `projects/<projectId>/boards/<newBoardId>.json`
2. Append board summary in:
   - `projects/<projectId>/project.json -> boards[]`
3. Update `updatedAt` values in `project.json` and optionally in `index.json`.

## C) Portable JSON: add project and board

1. Append new object in `projects[]`.
2. Add one or more board payloads in `projects[n].boards[]`.
3. Optionally add `assets[]` with `base64`.
4. Restart with:
   - `ELENWEAVE_SEED_JSON=/path/to/seed.json`

## Read-only and fork modes

Configure:

- `ELENWEAVE_SEED_READONLY` / `--seed-readonly`: `off | all | projects`
- `ELENWEAVE_READONLY_FORK` / `--readonly-fork`: `off | local`

Behavior:

- `off`:
  - Seeded data is editable on server.
- `all`:
  - All mutating project/board/asset APIs return `403 ReadOnlySeed`.
- `projects`:
  - Only listed projects are read-only.
- `fork=local`:
  - Browser auto-switches to local IndexedDB fork mode when a read-only mutation is attempted.
  - Hosted seeded data remains unchanged.
- `fork=off`:
  - Read-only mutations stay blocked; no local fork handoff.

## Runtime config visible to app

When serving `app/index.html`, server injects runtime fields:

- `storageMode: "server"`
- `seedReadOnlyMode`
- `seedReadOnlyProjectIds`
- `readOnlyFork`

The app uses these to decide whether to remain server-backed or switch to local fork mode.

## Recommended production approach

1. Prefer native snapshot format for stable operations.
2. Use `first-run` policy for safe bootstrap.
3. Use `versioned` policy only when you control release versions.
4. Use `readOnly=projects` for curated canonical content.
5. Keep `fork=local` enabled so users can still edit without mutating canonical hosted content.

## Quick command examples

Native seed + first run:

```bash
ELENWEAVE_DATA_DIR=/srv/elenweave \
ELENWEAVE_SEED_DIR=/srv/seed \
ELENWEAVE_SEED_POLICY=first-run \
node server/index.js
```

Portable seed + versioned:

```bash
ELENWEAVE_DATA_DIR=/srv/elenweave \
ELENWEAVE_SEED_JSON=/srv/seed/seed.json \
ELENWEAVE_SEED_POLICY=versioned \
ELENWEAVE_SEED_VERSION=2026.02.16 \
node server/index.js
```

Read-only canonical data with local fork:

```bash
ELENWEAVE_SEED_READONLY=projects \
ELENWEAVE_READONLY_FORK=local \
npx elenweave-app --mode server --seed-dir /srv/seed
```
