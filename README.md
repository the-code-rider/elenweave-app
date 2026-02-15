# Elenweave

Elenweave is a shared canvas where humans and AI agents can think, sketch, and build together.

It is designed for expressive work: drop ideas as nodes, connect them, attach media, and let AI turn prompts into structured plans on the same board. The goal is not just chat output, but visible thinking you can edit, reorganize, and evolve.

## What It Is

- A visual workspace for projects and boards
- A collaboration surface for human input + AI-generated structure
- A lightweight local app with file-backed server mode or browser-only client mode

## Core Capabilities

- Create and edit boards with rich node types (text, forms, charts, code, markdown, media)
- Ask AI to generate board actions using the `ew-actions/v1` plan contract
- Add follow-up AI interactions through `TextInput` and `OptionPicker` nodes
- Attach image/audio/text assets to nodes
- Persist work by project/board (server mode) or IndexedDB (client mode)

## Run Locally

```bash
npm run server
```

Open:

```text
http://127.0.0.1:8787/app/index.html
```

## Optional: Local AI Proxy

When running the local server, AI keys can be loaded from environment variables or config file so browser requests are served through local `/api/ai/*` endpoints.

See:

- `docs/SERVER.md`
- `server/config.example.json`

## Configuration

### Browser Runtime Config (`window.__ELENWEAVE_RUNTIME__`)

Configured in `app/index.html` (and overridden by `server/index.js` when served by the local server).

Accepted params:

| Param | Type | Required | Description |
|---|---|---|---|
| `storageMode` | `'client' \| 'server'` | Yes | Storage source-of-truth mode. |
| `serverBase` | `string` | No | Base URL for server API in `server` mode. Defaults to same-origin (`''`). |

### AI Config File (`config.json`)

File lookup order:

1. `ELENWEAVE_AI_CONFIG` (explicit path)
2. `./config.json`
3. `./server/config.json`

Accepted params:

| Param | Type | Description |
|---|---|---|
| `openaiApiKey` | `string` | OpenAI key |
| `geminiApiKey` | `string` | Gemini key |
| `googleApiKey` | `string` | Gemini-compatible Google key |
| `openai.apiKey` | `string` | OpenAI key (nested form) |
| `gemini.apiKey` | `string` | Gemini key (nested form) |
| `providers.openai.apiKey` | `string` | OpenAI key (provider map form) |
| `providers.gemini.apiKey` | `string` | Gemini key (provider map form) |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `HOST` | `127.0.0.1` | Server bind host |
| `PORT` | `8787` | Server bind port |
| `ELENWEAVE_DATA_DIR` | `~/.elenweave` | Data root for projects/boards/assets |
| `ELENWEAVE_LOCK_TIMEOUT_MS` | `5000` | Lock wait timeout (ms) |
| `ELENWEAVE_LOCK_RETRY_MS` | `50` | Lock retry interval (ms) |
| `ELENWEAVE_AI_CONFIG` | _(unset)_ | Path to AI config JSON |
| `ELENWEAVE_OPENAI_API_KEY` | _(unset)_ | Preferred OpenAI key env var |
| `OPENAI_API_KEY` | _(unset)_ | OpenAI key env var |
| `ELENWEAVE_GEMINI_API_KEY` | _(unset)_ | Preferred Gemini key env var |
| `GEMINI_API_KEY` | _(unset)_ | Gemini key env var |
| `GOOGLE_API_KEY` | _(unset)_ | Gemini-compatible Google key env var |

AI key precedence:

- OpenAI: `ELENWEAVE_OPENAI_API_KEY` -> `OPENAI_API_KEY` -> config file values
- Gemini: `ELENWEAVE_GEMINI_API_KEY` -> `GEMINI_API_KEY` -> `GOOGLE_API_KEY` -> config file values

## Project Structure

- `app/` client app and AI/UI logic
- `server/` static hosting + REST APIs for projects/boards/assets/AI proxy
- `docs/` architecture, server behavior, and AI feature docs
