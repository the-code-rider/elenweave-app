# Follow-Up Input Flow

This document explains how AI follow-up input works with `OptionPicker` and `TextInput`.

## Prompt Behavior

The AI prompt is explicitly instructed to request user input using follow-up nodes when needed.

- In `app/app.js` (`buildAiPrompt`), the rules include:
  - Add a `TextInput` or `OptionPicker` node with:
  - `data.aiFollowUp = { question, status: "open" }`

## Which Nodes Are Treated As Follow-Ups

The app treats a selected node as an AI follow-up node only when all conditions are true:

1. Node has `data.aiFollowUp`
2. Node component is `TextInput` or `OptionPicker`
3. `data.aiFollowUp.status !== "done"`

This is implemented by:

- `AI_FOLLOW_UP_COMPONENTS = new Set(['TextInput', 'OptionPicker'])`
- `getAiFollowUpNode()`

## Trigger Conditions

A follow-up AI call is triggered by user action (not automatically):

1. User selects the follow-up node.
2. User provides input:
   - `OptionPicker`: from `data.choice` / `data.value`
   - `TextInput`: from `data.value` / `data.text`
3. Send button changes to `Run` and is enabled only when input exists.
4. User clicks `Run` (or Send while in follow-up mode).
5. App calls `handleAiFollowUp(...)` and sends:
   - original follow-up question
   - user answer
6. After successful apply, node is marked:
   - `data.aiFollowUp.status = "done"`

## Practical Result

- The model can ask clarification questions through board-native UI nodes.
- The human answer is captured on-canvas.
- The next AI step runs only after the human explicitly triggers it.
