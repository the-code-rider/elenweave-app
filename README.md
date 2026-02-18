<p align="center">
  <img src="./logo.webp" alt="Elenweave logo" width="180" />
</p>

<p align="center">
  <a href="https://elenweave.com">https://elenweave.com</a>
</p>

# Elenweave

Give your coding agents a canvas to express themselves.

Elenweave is a shared canvas for coding agents and humans to collaborate. The core app exposes a surface for coding agents to express complex ideas as rich graph on canvas. 
The agent controls the canvas via skill. While a human can manipulate the canvas by manualy placing nodes or by using an embedded AI. 

> This project is early stage, and it likely has bugs. It has only tested against codex so far. However the skill is general and should work with other agents.

## Goal
Move coding agents beyond terminal and markdown file. Terminal is still the fastest way to build a software app, but it is not the right surface to build an understanding about the code.
Coding agents have accelarated the pace of development. They have also accelarated the 

## What It Is

- A visual workspace for projects and boards
- A collaboration surface for human input + AI-generated structure
- A lightweight local app with file-backed server mode or browser-only client mode

## Use Cases

- You can control the app via coding agent. That is ask the agent to create documentation on a specific topic or a plan and it will update the app using the skill
- You can directly use the canvas in your browser. 
- The same board and can be read and updated by an agent and human

## Modes
- You can either run it locally or self host as server, in which case it will use file system as storage block.
- Or you can run a client only mode, in which case it will use IndexedDB as storage. 
More details can be found below.

## Core Capabilities

- Create and edit boards with rich node types (text, forms, charts, code, markdown, media)
- Use `MermaidBlock` and `SvgBlock` nodes for diagram-driven explanations
- Ask AI to generate board actions using the `ew-actions/v1` plan contract
- Add follow-up AI interactions through `TextInput` and `OptionPicker` nodes
- Attach image/audio/text assets to nodes
- Use realtime Gemini voice mode from the app panel (experimental)
- Persist work by project/board (server mode) or IndexedDB (client mode)

## Run Locally

Install globally (optional):

```bash
npm i -g elenweave-app
```

Run (recommended, no global install needed):

```bash
npx elenweave-app
```

Run after global install:

```bash
elenweave-app
```

Install Codex skill:
skill repo: https://github.com/the-code-rider/elenweave-skill


```bash
npx skills add the-code-rider/elenweave-skill
```

Default behavior with no flags (`npx elenweave-app`):

- mode: `server`
- host: `127.0.0.1`
- port: `8787`
- data root: `~/.elenweave` (Windows: `%USERPROFILE%\\.elenweave`)
- API routes enabled (`/api/*`)
- browser runtime injected as `storageMode: "server"`
- seed policy default: `first-run`
- seed read-only mode default: `off`
- read-only fork default: `local`

Open:

```text
http://127.0.0.1:8787/
```

Development run from repo:

```bash
npm run server
```

Run as packaged app (published):

```bash
npx elenweave-app
```

Or run with file-watch:

```bash
npm run dev
```

CLI mode:

```bash
npm run server:cli -- --mode server --host 0.0.0.0 --port 8080
# or
node server/cli.js --mode server --host 0.0.0.0 --port 8080
```

Client-only runtime (browser IndexedDB, API disabled):

```bash
npx elenweave-app --mode client
# or
npm run server:cli -- --mode client
```

If startup fails with `EADDRINUSE` on `127.0.0.1:8787`, either stop the process using that port or start on a different port:

```bash
npm run server:cli -- --port 8788
```

## Desktop App (Electron, Experimental)

Run from this repo:

```bash
npm run desktop:install
npm run desktop:dev
```

Build Windows installer:

```bash
npm run desktop:build:win
```

Desktop runtime behavior:

- Starts local Elenweave server (`server/cli.js`) automatically
- Opens app at `http://127.0.0.1:<port>/app/index.html`
- Exposes localhost API for coding agents at `http://127.0.0.1:<port>/api/*`
- If preferred port is busy, falls forward to next free port up to `maxPort`

Desktop config file:

- Path: `%APPDATA%\\Elenweave\\config.json`
- Created automatically on first run
- Example shape: `desktop/config.example.json`

Supported desktop config keys:

- `port`: preferred start port (default `8787`)
- `maxPort`: upper bound for fallback scan (default `8899`)
- `mode`: runtime mode (`server` default)
- `dataDir`: server storage root (default `~/.elenweave`)
- `configPath`: path to app/AI config JSON (maps to `ELENWEAVE_CONFIG`)
- `aiConfigPath`: optional dedicated AI config JSON (maps to `ELENWEAVE_AI_CONFIG`)
- `envOverrides`: additional env vars passed to local server process

Desktop-only in-app settings panel:

- Open `Settings` in the sidebar
- Use the `Desktop` section to view runtime info, edit `port/dataDir/configPath/aiConfigPath`, save config, and restart server

## Optional: Local AI Proxy

When running the local server, AI keys can be loaded from environment variables or config file so browser requests are served through local `/api/ai/*` endpoints.

See:

- `docs/SERVER.md`
- `docs/seed.md`
- `docs/followup.md`
- `server/config.example.json`

## Configuration

### Browser Runtime Config (`window.__ELENWEAVE_RUNTIME__`)

Configured in `app/index.html` (and overridden by `server/index.js` when served by the local server).

Accepted params:

| Param | Type | Required | Description |
|---|---|---|---|
| `storageMode` | `'client' \| 'server'` | Yes | Storage source-of-truth mode. |
| `serverBase` | `string` | No | Base URL for server API in `server` mode. Defaults to same-origin (`''`). |
| `seedReadOnlyMode` | `'off' \| 'all' \| 'projects'` | No | Hosted seed read-only mode injected by server. |
| `seedReadOnlyProjectIds` | `string[]` | No | Read-only project IDs when `seedReadOnlyMode='projects'`. |
| `readOnlyFork` | `'off' \| 'local'` | No | Read-only edit behavior (`local` = browser IndexedDB fork). |
| `experimentalHandControls` | `boolean` | No | Enable/disable MediaPipe hand-controls feature availability at runtime. |
| `handControlsModelBaseUrl` | `string` | No | Optional base URL for `hand_landmarker.task` (defaults to hosted MediaPipe model). |

Mode behavior:

- `storageMode: "server"`: app uses `/api/projects/*` and file-backed server storage.
- `storageMode: "client"`: app uses browser IndexedDB only and does not call server APIs.

### Experimental Hand Controls

- Toggle from `Tools` -> `Hand Controls` (`Off/On (exp)`).
- Feature is off by default and does not change existing mouse/keyboard/touch controls.
- When enabled, browser camera access is required; disabling stops the camera stream immediately.
- URL kill switch: append `?hand=off` to force-disable for that session URL.
- URL force-enable: append `?hand=on` to auto-enable at startup.

### App/AI Config File (`config.json`)

File lookup order:

1. `ELENWEAVE_CONFIG` (explicit path, CLI: `--config`)
2. `ELENWEAVE_AI_CONFIG` (legacy explicit path)
3. `~/.elenweave/config.json` (default location)
4. `./config.json`
5. `./server/config.json`

Accepted params:

| Param | Type | Description |
|---|---|---|
| `openaiApiKey` | `string` | OpenAI key |
| `geminiApiKey` | `string` | Gemini key |
| `googleApiKey` | `string` | Gemini-compatible Google key |
| `openaiModel` | `string` | Default OpenAI model used for AI requests |
| `geminiModel` | `string` | Default Gemini model used for AI requests |
| `openai.apiKey` | `string` | OpenAI key (nested form) |
| `gemini.apiKey` | `string` | Gemini key (nested form) |
| `openai.model` | `string` | Default OpenAI model (nested form) |
| `gemini.model` | `string` | Default Gemini model (nested form) |
| `openaiDefaultModel` | `string` | OpenAI default model (top-level alias) |
| `geminiDefaultModel` | `string` | Gemini default model (top-level alias) |
| `openai.defaultModel` | `string` | OpenAI default model (nested alias) |
| `gemini.defaultModel` | `string` | Gemini default model (nested alias) |
| `providers.openai.apiKey` | `string` | OpenAI key (provider map form) |
| `providers.gemini.apiKey` | `string` | Gemini key (provider map form) |
| `providers.openai.model` | `string` | Default OpenAI model (provider map form) |
| `providers.gemini.model` | `string` | Default Gemini model (provider map form) |
| `providers.openai.defaultModel` | `string` | OpenAI default model (provider alias) |
| `providers.gemini.defaultModel` | `string` | Gemini default model (provider alias) |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `HOST` | `127.0.0.1` | Server bind host |
| `PORT` | `8787` | Server bind port |
| `ELENWEAVE_RUNTIME_MODE` | `server` | Runtime mode: `server` or `client` |
| `ELENWEAVE_DATA_DIR` | `~/.elenweave` | Data root for projects/boards/assets |
| `ELENWEAVE_LOCK_TIMEOUT_MS` | `5000` | Lock wait timeout (ms) |
| `ELENWEAVE_LOCK_RETRY_MS` | `50` | Lock retry interval (ms) |
| `ELENWEAVE_SEED_DIR` | _(unset)_ | Native seed directory (data-root snapshot) |
| `ELENWEAVE_SEED_JSON` | _(unset)_ | Portable JSON seed file |
| `ELENWEAVE_SEED_POLICY` | `first-run` | Seed apply policy: `first-run`, `always`, `versioned` |
| `ELENWEAVE_SEED_VERSION` | _(unset)_ | Seed version used with `versioned` policy |
| `ELENWEAVE_SEED_READONLY` | `off` | Seed read-only mode: `off`, `all`, `projects` |
| `ELENWEAVE_READONLY_FORK` | `local` | Read-only fork behavior: `local` or `off` |
| `ELENWEAVE_EXPERIMENTAL_HAND_CONTROLS` | `true` | Enable or disable MediaPipe hand-controls runtime toggle |
| `ELENWEAVE_HAND_CONTROLS_MODEL_BASE_URL` | _(unset)_ | Optional base URL containing `hand_landmarker.task` |
| `ELENWEAVE_CONFIG` | _(unset)_ | Path to app/AI config JSON |
| `ELENWEAVE_AI_CONFIG` | _(unset)_ | Path to AI config JSON |
| `ELENWEAVE_OPENAI_API_KEY` | _(unset)_ | Preferred OpenAI key env var |
| `OPENAI_API_KEY` | _(unset)_ | OpenAI key env var |
| `ELENWEAVE_GEMINI_API_KEY` | _(unset)_ | Preferred Gemini key env var |
| `GEMINI_API_KEY` | _(unset)_ | Gemini key env var |
| `GOOGLE_API_KEY` | _(unset)_ | Gemini-compatible Google key env var |
| `ELENWEAVE_OPENAI_MODEL` | _(unset)_ | Default OpenAI model for server-side AI proxy |
| `ELENWEAVE_GEMINI_MODEL` | _(unset)_ | Default Gemini model for server-side AI proxy |
| `ELENWEAVE_OPENAI_DEFAULT_MODEL` | _(unset)_ | Alias for OpenAI default model env var |
| `ELENWEAVE_GEMINI_DEFAULT_MODEL` | _(unset)_ | Alias for Gemini default model env var |

AI key precedence:

- OpenAI: `ELENWEAVE_OPENAI_API_KEY` -> `OPENAI_API_KEY` -> config file values
- Gemini: `ELENWEAVE_GEMINI_API_KEY` -> `GEMINI_API_KEY` -> `GOOGLE_API_KEY` -> config file values

AI model precedence:

- OpenAI: `ELENWEAVE_OPENAI_MODEL` -> `ELENWEAVE_OPENAI_DEFAULT_MODEL` -> config file values -> app fallback
- Gemini: `ELENWEAVE_GEMINI_MODEL` -> `ELENWEAVE_GEMINI_DEFAULT_MODEL` -> config file values -> app fallback

## Project Structure

- `app/` client app and AI/UI logic
- `server/` static hosting + REST APIs for projects/boards/assets/AI proxy
- `docs/` architecture, server behavior, and AI feature docs
