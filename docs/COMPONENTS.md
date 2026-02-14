# App Components Guide

This doc lists all components available in `app`, how to use them, and how to add new ones.

## How components are used

Components are configured in `app/app.js` inside `COMPONENT_CONFIG`.
Each entry defines:

- `key` (unique id)
- `label` (UI label)
- `component` (Elenweave component name)
- `size` (default width/height)
- `fields` (input fields shown in the input bar)

On send, the app creates a node using these fields and adds it to the board.

## Available components

### AI

- **Key**: `AI`
- **What it does**: Sends a prompt to the LLM and applies the returned plan.
- **Fields**:
  - `prompt` (textarea)
  - `media` (file upload: image/audio/text/code)
- **Notes**:
  - In AI mode, clicking nodes toggles them as context.
  - The prompt includes board context, history, and attachments as needed.

### Editable Text

- **Key**: `HtmlText`
- **Component**: `html-text` (native)
- **Use**: Simple editable text blocks on the board.

### Option Picker

- **Key**: `OptionPicker`
- **Component**: `OptionPicker`
- **Use**: Single selection from a list.

### Text Input

- **Key**: `TextInput`
- **Component**: `TextInput`
- **Use**: Freeform text input.

### Datetime

- **Key**: `DateTimeInput`
- **Component**: `DateTimeInput`
- **Use**: Date + time input.

### Slider Input

- **Key**: `SliderInput`
- **Component**: `SliderInput`
- **Use**: Numeric slider input.

### Multiple Choice

- **Key**: `MultiChoice`
- **Component**: `MultiChoice`
- **Use**: Multi-select options.

### Code Snippet

- **Key**: `CodeSnippet`
- **Component**: `CodeSnippet`
- **Use**: Code blocks and file-based code attachments.

### SVG Diagram

- **Key**: `SvgBlock`
- **Component**: `SvgBlock` (local app component)
- **Use**: Render sanitized inline SVG markup.
- **Fields**:
  - `title`
  - `svg` (raw markup)
  - `file` (optional `.svg` upload that fills `data.svg`)

### Mermaid Diagram

- **Key**: `MermaidBlock`
- **Component**: `MermaidBlock` (local app component)
- **Use**: Render Mermaid syntax diagrams.
- **Fields**:
  - `title`
  - `mermaid` (diagram source string)

### Image Viewer

- **Key**: `ImageViewer`
- **Component**: `ImageViewer`
- **Use**: Image nodes stored as assets.

### Video Player

- **Key**: `VideoPlayer`
- **Component**: `VideoPlayer`
- **Use**: Video nodes stored as assets.

### Audio Player

- **Key**: `AudioPlayer`
- **Component**: `AudioPlayer`
- **Use**: Audio nodes stored as assets.

### Charts

Charts are available for AI output and for manual use:

- `LineChart`
- `AreaChart`
- `BarChart`
- `ScatterChart`
- `HeatmapChart`
- `RadarChart`
- `SparklineChart`

These are registered in `app.js` and described in `CHART_COMPONENT_SPECS`.

### Markdown Block

- **Key**: `MarkdownBlock`
- **Component**: `MarkdownBlock` (local app component)
- **Use**: Render AI markdown output.

## How to add a new component

1) **Import or implement it**
   - For core components, import from the Elenweave CDN.
   - For app-only components, create a local file in `app/`.

2) **Register it**
   - In `app.js`, call:
     ```js
     view.registerComponent('MyComponent', { render: MyComponent });
     ```

3) **Add it to `COMPONENT_CONFIG`**
   - Add a new entry with `key`, `label`, `component`, `size`, and `fields`.

4) **(Optional) Add AI support**
   - If you want AI to use the component, update the AI prompt section and chart specs.

## Tips

- Use concise `key` values (PascalCase).
- Keep `fields` simple; these map to `node.props` or `node.data`.
- If the component uses assets, set `assetType` and include file input fields.
