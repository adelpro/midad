# Editor Selection & Background Behavior

> How selection works in the midad editor — the Select tool, multi-select, and
> the background image flow. This is the behavior contract; when code and this
> document disagree, fix the code.

---

## 1. The two state axes

The editor keeps two independent states that must stay in sync:

| State             | Where                         | Values                                                |
| ----------------- | ----------------------------- | ----------------------------------------------------- |
| `tool`            | local state in `EditorScreen` | `select` · `text` · `insert` · `color` · `background` |
| `multiSelectMode` | zustand store                 | on / off                                              |

Plus `selectedIds` (the current selection) and the gesture scratch
(`gs.selectionHandledOnDown`, `gs.additiveSelect`) that make the two halves of a
single press agree.

## 2. How a press is resolved

A canvas press is split into two halves:

1. **Pointer-down** — `beginDrag` (`use-object-gestures.ts`) decides the
   selection the instant the finger lands (`pan.onBegin`).
2. **Tap-up** — `handleTapResult` (`EditorScreen.tsx`) runs only when the press
   was a quick tap (no drag): `tap.onEnd` → `tapPoint` → `EditorCanvas` effect →
   `hitTest` → `onTapResult`.

`gs.additiveSelect` records _what the press meant_ at pointer-down (multi-select
tool on, or Shift/Cmd/Ctrl held on web). The tap-up half reads that same value,
so the two halves can never contradict each other.

## 3. Select tool

- **Tap an object** → it becomes the selection (single); handles appear.
- **Tap a grouped object** → the whole group becomes the selection, and the group
  box (no handles) appears. See [`editor-groups.md`](editor-groups.md).
- **Tap empty space** → selection clears.
- **Drag an object** → moves it; its handles resize/rotate it.
- **Drag is gated on the Select tool.** In any other tool you can tap to select,
  but dragging/resizing/rotating only works in Select.

## 4. Multi-select

Enter it via the **multi-select button** in the rail, or on web with
**Shift / Cmd / Ctrl** while clicking.

While additive is on:

- **Tap an unselected object** → adds it to the selection (does not replace).
- **Tap an already-selected object** → deselects it (the toggle idiom).
- **Tap a member of a group** → the whole group is added or removed, never one
  member: a selection is always a union of whole groups
  ([`editor-groups.md`](editor-groups.md) §3).
- **Drag a selected object** → moves the whole group.
- **Tap empty space** → clears everything.

Exiting multi-select:

- **Select button** (or the `S` shortcut) → exits the mode and **keeps the
  group** selected (the group box stays).
- **Multi-select button** toggling off → also keeps the group.
- **Text / Insert / Color / Background buttons** → exit multi-select and
  **collapse to the single last-touched object**, because those tools act on one
  object at a time.

## 5. Background image

- **Background tool** → paper swatches + image button appear in the rail.
- **Paper swatch** → sets the paper color; the tool **stays on Background** so
  you can try several.
- **Image button** → opens the system photo picker. On a successful pick:
  - the image is embedded into the project (base64, travels with `.midad.json`
    export), and
  - the tool **auto-returns to Select** so you can immediately tap/drag.
- **Cancel** the picker → stays on Background.
- **Trash button** (shown when an image is set) → reverts to the default paper.

## 6. Why the race is gone

Previously, after picking a background image, tapping a text element did not
select it, and in multi-select the pointer-down and tap-up halves could
disagree. Now:

1. **Taps select in every tool** — the canvas is never "dead" after a
   background change.
2. **`additiveSelect` is recorded at pointer-down and read at tap-up** — the two
   halves of a press always agree.
3. **Background image pick returns to Select** — the flow that used to strand
   you in a non-draggable tool now lands you back in normal editing.

## 7. Code map

| Concern                                            | File                                      |
| -------------------------------------------------- | ----------------------------------------- |
| Tool rail buttons, `handleTapResult`, `setBgImage` | `src/editor/EditorScreen.tsx`             |
| `beginDrag`, gesture composition, modifier wiring  | `src/editor/use-object-gestures.ts`       |
| `setMultiSelectMode`, `select`, gesture scratch    | `src/editor/store.ts`                     |
| Web Shift/Cmd/Ctrl tracking                        | `src/editor/modifier-keys.ts` / `.web.ts` |
| Hit-testing + grab tolerance                       | `src/editor/hit-test.ts`                  |

## 8. Related documents

This document owns the **selection semantics** — the two state axes, the press
race, and the background flow. The other contracts link back here rather than
restating them:

| Document                                                     | Relationship                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| [`editor-gestures.md`](editor-gestures.md)                   | §2 covers the `beginDrag` decision table that calls `select` and `setMultiSelectMode` |
| [`editor-state-and-history.md`](editor-state-and-history.md) | §7 documents the `gs` scratch fields named here                                       |
| [`editor-selection-bar.md`](editor-selection-bar.md)         | The rail's action set, width budget and pins                                          |
| [`editor-coordinates.md`](editor-coordinates.md)             | §7 covers the handle geometry the tap path shares                                     |
| [`editor-keyboard.md`](editor-keyboard.md)                   | §9 covers the Shift/Cmd/Ctrl flag the multi-select path reads                         |
| [`editor-groups.md`](editor-groups.md)                       | Owns group membership and the whole-groups invariant the multi-select toggle obeys    |
