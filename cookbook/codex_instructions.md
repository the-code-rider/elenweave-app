# Codex Instruction: Codebase-to-Elenweave Boards

## Goal
Iterate through the entire codebase, analyze every file, and create rich, explorable boards in a **new Elenweave project**. The boards should capture architecture, data flow, and key behaviors.

## Required Output
- **Create a new Elenweave project** for this analysis.
- **Create multiple boards** (not just one) to keep content navigable.
- Boards must include:
  - **Relevant code snippets** (small, high-signal excerpts).
  - **Rich visual flow** (system maps, module diagrams, request/response flows).
  - **Mermaid diagrams** where appropriate.
  - **SVG diagrams** where appropriate.

## Process
1. **Scan the repository**
   - Read every file (code, config, docs).
   - Identify modules, entry points, and critical flows.
   - Track dependencies and data flow across files.

2. **Synthesize into boards**
   - Create a top-level architecture board.
   - Create feature or subsystem boards (group related modules).
   - Create flow boards for critical paths (e.g., request lifecycle, data pipeline).

3. **Use diagrams intentionally**
   - **Mermaid**: sequences, state, dependency graphs.
   - **SVG**: custom component maps, layered architecture visuals.

4. **Embed code excerpts**
   - Prefer small snippets that explain the flow.
   - Reference file paths and line numbers with each snippet.

## Quality Bar
- Every board should be explorable and readable on its own.
- Focus on **clarity, hierarchy, and narrative flow**.
- Avoid repeating the same content across boards; cross-link instead.

## Deliverables
- New Elenweave project with multiple rich boards.
- Boards include diagrams (Mermaid + SVG), html-text, markdown and code excerpts.
