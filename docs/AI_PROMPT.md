# AI Prompt & Followâ€‘Up Flow

This doc explains how the AI prompt is built and how the app uses inbuilt components
to ask the user followâ€‘up questions and then run the next AI call.

## Where it lives

Prompt logic and AI flow live in:

- `app/app.js` (prompt assembly, parsing, node creation, followâ€‘ups)
- `app/llm_clients.js` (provider calls)
- `app/markdown-block.js` (markdown output node)
- `app/svg-block.js` (SVG diagram node)
- `app/mermaid-block.js` (Mermaid diagram node)

## Prompt construction (high level)

When the user sends an AI request (AI component selected), the app:

1) Collects current board state if no explicit node/file context was selected.
2) Collects selected context nodes (multiâ€‘select in AI mode).
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

The AI is instructed to return a JSON â€œplanâ€ that contains:

- `nodes`: list of new or updated nodes
- `edges`: list of new edges
- Optional `updates` when reusing existing node ids

The app parses this plan, validates it, and applies it to the active graph.

## Inbuilt components used for followâ€‘ups

When the AI needs more input, it can ask the user via:

- **TextInput** (freeform text)
- **OptionPicker** (singleâ€‘choice options)

These are native Elenweave components already registered in the app:

- `OptionPicker`
- `TextInput`

## Followâ€‘up flow (ask â†’ capture â†’ run)

1) AI response includes nodes for `TextInput` and/or `OptionPicker`.
2) These nodes appear on the board.
3) The user interacts with the component(s).
4) The user triggers the next â€œSendâ€ action.
5) The app extracts the values from those nodes and adds them to the next prompt.

The app treats these nodes as **AI followâ€‘up inputs** by type, so it can
autoâ€‘collect their values before the next model call.

## Where the input is read

In `app.js` the followâ€‘up input collection happens by:

- Detecting nodes whose component is in `AI_FOLLOW_UP_COMPONENTS`
- Reading `node.props` and `node.data`
- Encoding the userâ€™s response into the next promptâ€™s context

Key constant:

- `AI_FOLLOW_UP_COMPONENTS = new Set(['TextInput', 'OptionPicker'])`

## Summary

- The prompt is built from board + history + context nodes + attachments.
- The AI can ask for user input using inbuilt nodes.
- The userâ€™s responses are captured from those nodes and appended to the next prompt.

## Interactive apps and games

When the user explicitly asks for an interactive app, game, or demo, the prompt
steers the model to produce a runnable HTML+JS canvas experience. The response
should include a `CodeSnippet` node (full HTML in `data.code`) and an
`HtmlPreview` node (same HTML in `data.html`) linked by an edge. The HTML should
use `<canvas>` with `requestAnimationFrame`, include basic input handling when
relevant, avoid `eval` or infinite loops, and keep animation complexity bounded.
External libraries via CDN are allowed only if they materially simplify the
request.

If a task-specific AppGen model is configured, app/game/canvas prompts will use
that model instead of the provider default.
