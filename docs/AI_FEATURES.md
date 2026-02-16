# AI Features (app)

This document summarizes the AI-specific features implemented in the app layer (`app`).

## Models & Providers
- Default models:
  - OpenAI: `gpt-5-mini`
  - Gemini: `gemini-3-flash-preview`
- In local server mode, `config.json` can provide provider-specific defaults (`openaiModel`, `geminiModel`) used automatically for AI requests unless the browser has a local override.
- Model Config panel supports per-provider API keys + model overrides.
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

## UI/UX Enhancements
- Ctrl/Cmd + Enter sends AI input.
- Send button pulses while AI request is in-flight.
- AI upload shows selected file state; upload button uses an icon-only UI in AI mode.
- Record button hidden in AI mode (AI uses file upload + transcription).

---

If you need a full prompt spec or schema changes, refer to `buildAiPrompt()` and `applyAiPlan()` in `app/app.js`.
