# AI Features (app)

This document summarizes the AI-specific features implemented in the app layer (`app`).

## Models & Providers
- Default models:
  - OpenAI: `gpt-5-mini`
  - Gemini: `gemini-3-flash-preview`
- In local server mode, `config.json` can provide provider-specific defaults (`openaiModel`, `geminiModel`) and keys (`openaiApiKey`, `geminiApiKey`) used automatically for AI requests unless the browser has a local override.
- Model Config panel supports per-provider API keys + model overrides stored locally in the browser.
- Task model overrides (optional):
  - Config keys: `openaiModels` / `geminiModels` with `general`, `appGen`, `codeExplain`.
  - UI overrides stored locally (per provider).
  - Resolution order: config task model → UI task model → config provider default → UI provider default → built-in default.
- In local server mode, AI calls can use server-side keys from env/config via `/api/ai/*` proxy routes.

## Prompt & Output Contract
- Detailed system prompt describes the Elenweave environment and available components.
- JSON-only output contract (`ew-actions/v1`) with nodes/edges and add/update actions.
- Rules enforced in prompt:
  - No `x/y` coordinates (auto-place in app).
  - Prefer small, single-idea nodes.
  - Add edges between new nodes and only link to existing nodes when relevant.
  - Use `MarkdownBlock` for formatted text / code fences.
  - Use `MermaidBlock` for Mermaid syntax diagrams and `SvgBlock` for raw SVG markup diagrams.

## Context & History
- Board snapshot and AI history (last 4 turns) included **only when no node or file is selected**.
- Selected nodes can be multi-selected as AI context (AI mode keeps selection context).
- AI history stored per-board in graph metadata.

## Component Awareness
- AI is aware of all built-in components plus charts:
  - `OptionPicker`, `TextInput`, `DateTimeInput`, `SliderInput`, `MultiChoice`, `CodeSnippet`
  - `ImageViewer`, `VideoPlayer`, `AudioPlayer`
  - `SvgBlock`, `MermaidBlock`
  - Charts: `LineChart`, `AreaChart`, `BarChart`, `ScatterChart`, `HeatmapChart`, `RadarChart`, `SparklineChart`
  - `MarkdownBlock` (app-only) for formatted output
- Prompt includes guidance on when to use each component.

## Multimodal + File Handling
- Single AI upload control handles:
  - Images (`png/jpg/webp/gif/etc.`)
  - Audio (`mp3/wav/m4a/webm/etc.`)
  - Text/code files (`.md`, `.txt`, `.js`, `.ts`, `.json`, `.html`, `.css`, `.py`, etc.)
- Audio transcription:
  - OpenAI path uses Whisper (`whisper-1`) before planning.
  - Gemini path supports audio inline input.
- Text/code files are read client-side and injected into the prompt (truncated to a safe length).

## AI Output Handling
- AI response is parsed and applied as nodes/edges.
- Context nodes (selected for AI) are linked to one primary response node.
- Attachment nodes (image/audio) are added by the app and linked to the AI response.
- Camera focuses on the primary AI response node after apply.
- Notification created for AI response.

## Follow-up Questions
- AI can request user input via `TextInput` or `OptionPicker` using `data.aiFollowUp`.
- Selecting that node changes the Send button to **Run** and triggers a follow-up AI call.
- Follow-up node is marked `status: done` after completion, and linked to output nodes.

## Realtime Audio (Gemini Live)
- Realtime toggle connects to Gemini Live and streams audio.
- Tool calls support canvas actions (pan/zoom/fit/center/focus) and AI intent extraction.
- User and AI audio are saved back onto the canvas as `AudioPlayer` nodes.
- Visual live indicator + speaking/listening states.

## Codex SDK Integration Plan (Not Implemented)
This is a **plan only**. No Codex SDK integration has been implemented yet.

### Goals
- Run the Codex SDK server-side (Node) and expose an API to the app.
- Use the existing `ew-actions/v1` JSON plan contract to apply results to the canvas.
- Store Codex thread IDs for continuity across turns.

### Proposed Architecture
- **Server module**: add `server/codex_client.js` (or `server/ai/codex.js`) to wrap `@openai/codex-sdk`.
- **Thread storage**: persist `codexThreadId` in project or board metadata.
- **API routes**:
  - `POST /api/ai/codex/run` → runs a turn and returns `finalResponse`, `items`, and `threadId`.
  - Optional `POST /api/ai/codex/stream` → streams events (NDJSON/SSE) for progress UI.
- **Client flow**:
  - Add provider option `codex`.
  - Reuse `buildAiPrompt()` and send as Codex input.
  - Require Codex to return `ew-actions/v1` JSON; parse/apply via existing `applyAiPlan()`.

### Output Schema
- Enforce `{ version: "ew-actions/v1", nodes: [], edges: [] }` via Codex `outputSchema`.
- Reject or surface errors when output does not conform.

### Auth & Security
- Codex CLI runs in the server environment; use server env keys only.
- Limit filesystem scope and permissions where the server runs Codex.

## UI/UX Enhancements
- Ctrl/Cmd + Enter sends AI input.
- Send button pulses while AI request is in-flight.
- AI upload shows selected file state; upload button uses an icon-only UI in AI mode.
- Record button hidden in AI mode (AI uses file upload + transcription).

---

If you need a full prompt spec or schema changes, refer to `buildAiPrompt()` and `applyAiPlan()` in `app/app.js`.
