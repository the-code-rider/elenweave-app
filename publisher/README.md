# R2 Publisher

Standalone Node.js script to publish a local Elenweave project into a public R2 catalog.

## Install

```bash
cd publisher
npm install
```

## Required env vars

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_ENDPOINT_URL` (R2 S3 endpoint, for example `https://<accountid>.r2.cloudflarestorage.com`)
- `AWS_REGION` (use `auto` for R2)
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL` (public base URL used to build manifest/catalog links)

## Usage

```bash
node publish.js --project-id <localProjectId> --catalog-id <catalogId> \
  --public-base-url https://cdn.example.com \
  --name "My Project" \
  --description "Short description" \
  --publisher "Your Name" \
  --version "1.0.0" \
  --tags "agents,canvas" \
  --cover ./cover.png
```

Default local data root is `~/.elenweave`. Override with `--data-dir`.

## What gets uploaded

```
public/
  catalog.json
  projects/
    <catalogId>/
      manifest.json
      boards/<boardId>.json
      assets/<assetId>.<ext>
      cover.<ext> (optional)
```

The script updates `public/catalog.json` by replacing the entry with the same `catalogId`
or appending if it does not exist.

## CLI flags

- `--project-id <id>` (required)
- `--catalog-id <id>` (required)
- `--data-dir <path>` override local data root
- `--name <string>` override project display name
- `--description <string>` override description
- `--publisher <string>` override publisher
- `--version <string>` override version
- `--tags <a,b,c>` comma-separated tags
- `--cover <path|url>` cover image path or URL
- `--public-base-url <url>` override `R2_PUBLIC_BASE_URL`
- `--catalog-key <key>` override catalog key (default `public/catalog.json`)
- `--dry-run` print plan only

## Git + R2 workflow ideas

### Option A: Git for metadata only
- Keep `catalog.json` and `manifest.json` in Git for review.
- CI uploads manifest/catalog to R2 on merge.
- Assets always uploaded directly to R2.

### Option B: Git as staging, R2 as deployment
- Script writes manifest/catalog locally for review.
- CI reads Git metadata and uploads to R2.

### Option C: Git tags for releases
- Tag releases in Git and let CI upload metadata + assets to R2.
- Useful for release history without versioned R2 paths.
