# AI Prompt & Follow‑Up Flow

This doc explains how the AI prompt is built and how the app uses inbuilt components
to ask the user follow‑up questions and then run the next AI call.

## Where it lives

Prompt logic and AI flow live in:

- `pages/app/app.js` (prompt assembly, parsing, node creation, follow‑ups)
- `pages/app/llm_clients.js` (provider calls)
- `pages/app/markdown-block.js` (markdown output node)
- `pages/app/svg-block.js` (SVG diagram node)
- `pages/app/mermaid-block.js` (Mermaid diagram node)

## Prompt construction (high level)

When the user sends an AI request (AI component selected), the app:

1) Collects current board state if no explicit node/file context was selected.
2) Collects selected context nodes (multi‑select in AI mode).
3) Collects file or media attachments (image/audio/text).
4) Adds graph metadata (AI history) when no node/file is selected.
5) Assembles a structured prompt with:
   - Environment header (running inside Elenweave canvas).
   - Component catalog (what the agent can create).
   - Output schema (nodes + edges).
   - Behavior rules (small nodes, relevant links, etc).
   - Context: board JSON, selected nodes, history, attachments.

Key prompt helpers in `app.js`:

- `buildAiPrompt(...)`
- `getAiHistoryEntries()`
- `truncateAiHistoryText(...)`
- `truncateAttachmentText(...)`
- `buildAiComponentSection(...)` (component rules + chart specs)

## Output contract (what AI should emit)

The AI is instructed to return a JSON “plan” that contains:

- `nodes`: list of new or updated nodes
- `edges`: list of new edges
- Optional `updates` when reusing existing node ids

The app parses this plan, validates it, and applies it to the active graph.

## Inbuilt components used for follow‑ups

When the AI needs more input, it can ask the user via:

- **TextInput** (freeform text)
- **OptionPicker** (single‑choice options)

These are native Elenweave components already registered in the app:

- `OptionPicker`
- `TextInput`

## Follow‑up flow (ask → capture → run)

1) AI response includes nodes for `TextInput` and/or `OptionPicker`.
2) These nodes appear on the board.
3) The user interacts with the component(s).
4) The user triggers the next “Send” action.
5) The app extracts the values from those nodes and adds them to the next prompt.

The app treats these nodes as **AI follow‑up inputs** by type, so it can
auto‑collect their values before the next model call.

## Where the input is read

In `app.js` the follow‑up input collection happens by:

- Detecting nodes whose component is in `AI_FOLLOW_UP_COMPONENTS`
- Reading `node.props` and `node.data`
- Encoding the user’s response into the next prompt’s context

Key constant:

- `AI_FOLLOW_UP_COMPONENTS = new Set(['TextInput', 'OptionPicker'])`

## Summary

- The prompt is built from board + history + context nodes + attachments.
- The AI can ask for user input using inbuilt nodes.
- The user’s responses are captured from those nodes and appended to the next prompt.
