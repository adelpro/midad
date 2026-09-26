---
title: midad — editor contracts
---

# midad docs — Contract Index

> Where to enter the code for each editor subsystem, and which contract explains
> it. This index is a map, not a contract: the documents below are the source of
> truth, and when one of them and the code disagree, fix the code.

---

## 1. What this index is

`docs/` holds one behavior contract per editor subsystem. A contract records what
the code cannot tell you on its own — the invariants, the traps, and the
trade-offs that were decided once — and closes with a `## N. Code map` table
mapping concerns to files.

This index reads the other way round: start from the task, get the contract, then
the file to open first. Every path below is copied from a code map in this folder.

## 2. Start here — by task

| Task                                                        | Contract                                                            | Open first                                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Change what a drag, pinch or rotate does                    | [`editor-gestures.md`](editor-gestures.md) §2                       | `src/editor/use-object-gestures.ts`                                |
| Change hit-testing, grab tolerance or handle shapes         | [`editor-coordinates.md`](editor-coordinates.md) §7                 | `src/editor/hit-test.ts`                                           |
| Change fit-to-view or the viewport                          | [`editor-coordinates.md`](editor-coordinates.md) §3                 | `src/editor/EditorCanvas.tsx`                                      |
| Make an edit undoable — or deliberately not                 | [`editor-state-and-history.md`](editor-state-and-history.md) §2     | `src/editor/store.ts`                                              |
| Add a shape or a glyph                                      | [`editor-render-contract.md`](editor-render-contract.md) §5         | `src/editor/skia/shape-geometry.ts`                                |
| Keep canvas, PNG and SVG agreeing                           | [`editor-render-contract.md`](editor-render-contract.md) §2         | `src/editor/render/offscreen.ts`, `src/editor/export/svg.ts`       |
| Change Arabic shaping or text measurement                   | [`editor-text-engine.md`](editor-text-engine.md) §1                 | `src/editor/skia/text.ts`                                          |
| Change how a word splits or rejoins                         | [`editor-split-and-rejoin.md`](editor-split-and-rejoin.md) §2       | `src/editor/text/clusters.ts`                                      |
| Make several objects act as one element                     | [`editor-groups.md`](editor-groups.md) §3                           | `src/editor/groups.ts`, `src/editor/store.ts`                      |
| Change the selection box, its handles or the collection bar | [`editor-collections.md`](editor-collections.md) §3                 | `src/editor/groups.ts`, `src/editor/EditorCanvas.tsx`              |
| Change how a press selects                                  | [`editor-selection.md`](editor-selection.md) §2                     | `src/editor/use-object-gestures.ts`, `src/editor/EditorScreen.tsx` |
| Add or reorder a selection-bar action                       | [`editor-selection-bar.md`](editor-selection-bar.md) §2             | `src/editor/selection-actions.tsx`                                 |
| Pin a font family in the picker                             | [`editor-font-pins.md`](editor-font-pins.md) §1                     | `src/theme/font-pins.ts`, `src/storage/font-pins.ts`               |
| Add a keyboard binding                                      | [`editor-keyboard.md`](editor-keyboard.md) §3                       | `src/editor/shortcuts.ts`                                          |
| Change a label, role, tooltip or help entry                 | [`editor-help-and-learn-mode.md`](editor-help-and-learn-mode.md) §2 | `src/editor/help/catalog.ts`                                       |

## 3. The contracts

| Document                                                         | Owns                                                                           | Entry point                                                                                                                                | Check                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| [`editor-coordinates.md`](editor-coordinates.md)                 | Four frames, fit-to-view, handle geometry                                      | `src/editor/hit-test.ts`, `src/editor/EditorCanvas.tsx`                                                                                    | —                        |
| [`editor-collections.md`](editor-collections.md)                 | The two states, the frame, the collection bar                                  | `src/editor/groups.ts`, `src/editor/collection-bar.tsx`                                                                                    | `check-groups.mjs`       |
| [`editor-color-picker.md`](editor-color-picker.md)               | Colour parsing, the picker sheet, per-visit undo                               | `src/theme/color.ts`, `src/editor/color-picker-sheet.tsx`                                                                                  | `check-color.mjs`        |
| [`editor-gestures.md`](editor-gestures.md)                       | Tap/pan/pinch/rotate, resize, release settle                                   | `src/editor/use-object-gestures.ts`                                                                                                        | —                        |
| [`editor-groups.md`](editor-groups.md)                           | Group membership, the whole-groups invariant                                   | `src/editor/groups.ts`, `src/editor/store.ts`                                                                                              | `check-groups.mjs`       |
| [`editor-help-and-learn-mode.md`](editor-help-and-learn-mode.md) | Help catalog, tooltips, learn mode                                             | `src/editor/help/catalog.ts`, `src/editor/help/use-help-mode.ts`                                                                           | `check-help.mjs`         |
| [`editor-keyboard.md`](editor-keyboard.md)                       | Binding table, matcher, chord text                                             | `src/editor/shortcuts.ts`, `src/editor/use-keyboard-shortcuts.web.ts`                                                                      | `check-shortcuts.mjs`    |
| [`editor-remote-fonts.md`](editor-remote-fonts.md)               | Remote Google Fonts: identity, catalogue, cache, registration, picker, banner  | `src/theme/remote-fonts.ts`, `src/storage/remote-font-cache.ts`, `src/storage/remote-font-registry.ts`, `src/editor/font-picker-sheet.tsx` | `check-remote-fonts.mjs` |
| [`editor-font-pins.md`](editor-font-pins.md)                     | Pinned font families: id namespaces, storage, picker section, remote fallbacks | `src/theme/font-pins.ts`, `src/storage/font-pins.ts`, `src/editor/font-picker-sheet.tsx`                                                   | `check-font-pins.mjs`    |
| [`editor-render-contract.md`](editor-render-contract.md)         | Canvas ↔ PNG ↔ SVG agreement                                                   | `src/editor/EditorCanvas.tsx`, `src/editor/render/offscreen.ts`, `src/editor/export/svg.ts`                                                | —                        |
| [`editor-selection-bar.md`](editor-selection-bar.md)             | The action rail, width budget, pins                                            | `src/editor/selection-actions.tsx`, `src/editor/EditorScreen.tsx`                                                                          | —                        |
| [`editor-selection.md`](editor-selection.md)                     | Select tool, multi-select, background flow                                     | `src/editor/use-object-gestures.ts`, `src/editor/store.ts`, `src/editor/hit-test.ts`                                                       | —                        |
| [`editor-split-and-rejoin.md`](editor-split-and-rejoin.md)       | The cluster split/rejoin algorithm                                             | `src/editor/text/clusters.ts`, `src/editor/text/split.ts`                                                                                  | `check-clusters.mjs`     |
| [`editor-state-and-history.md`](editor-state-and-history.md)     | Store slices, undo/redo, z-order                                               | `src/editor/store.ts`                                                                                                                      | —                        |
| [`editor-text-engine.md`](editor-text-engine.md)                 | Arabic shaping, auto width, paragraph lifetime                                 | `src/editor/skia/text.ts`, `src/editor/skia/use-text-layouts.ts`                                                                           | —                        |

## 4. Executable specs

There is no test runner. Several contracts own a standalone script that is the
real specification for their tables; run the one that covers what you touched.

| Script                           | Guards                                                       | Owner                                                               |
| -------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `scripts/check-clusters.mjs`     | Segmentation types + split/round-trip                        | [`editor-split-and-rejoin.md`](editor-split-and-rejoin.md) §9       |
| `scripts/check-groups.mjs`       | Expansion, units, predicates, the frame, the transform maths | [`editor-collections.md`](editor-collections.md) §3                 |
| `scripts/check-shortcuts.mjs`    | Binding table, matcher, chord text                           | [`editor-keyboard.md`](editor-keyboard.md) §10                      |
| `scripts/check-help.mjs`         | Catalog ↔ `strings.ts` ↔ `shortcuts.ts`                      | [`editor-help-and-learn-mode.md`](editor-help-and-learn-mode.md) §5 |
| `scripts/check-remote-fonts.mjs` | Remote font key format, face status, CDN URLs                | [`editor-remote-fonts.md`](editor-remote-fonts.md) §5               |
| `scripts/check-font-pins.mjs`    | Pin id namespaces + list operations                          | [`editor-font-pins.md`](editor-font-pins.md) §5                     |

Repo-wide, and cheaper than any of them: `npx tsc --noEmit` and `npx eslint src`.

All these scripts transpile and evaluate their target module standalone. That is
why `shortcuts.ts`, `help/catalog.ts` and `remote-fonts.ts` may declare **only
`import type`** (or no imports at all, for `remote-fonts.ts`), `i18n/strings.ts`
no imports at all, and `groups.ts` only a structural interface of its own — a
value import breaks the check silently.

## 5. Moves that span files

| Move                         | Files that must move together                                                  | Contract                                                            |
| ---------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| A new keyboard binding       | `shortcuts.ts` + `help/catalog.ts` + `i18n/strings.ts`, then both checks       | [`editor-help-and-learn-mode.md`](editor-help-and-learn-mode.md) §6 |
| A new selection-bar action   | `selection-actions.tsx` table entry + a `sel.<id>` catalog entry               | [`editor-selection-bar.md`](editor-selection-bar.md) §2 and §9      |
| A new shape                  | `skia/shape-geometry.ts` builder + the SVG and PNG paths                       | [`editor-render-contract.md`](editor-render-contract.md) §5         |
| A split/rejoin change        | `text/clusters.ts` + `store.ts` + `TextPartRef` in `storage/project-schema.ts` | [`editor-split-and-rejoin.md`](editor-split-and-rejoin.md) §8       |
| A new help or tooltip string | `i18n/strings.ts` + `help/catalog.ts` — never one alone                        | [`editor-help-and-learn-mode.md`](editor-help-and-learn-mode.md) §6 |
| A group-aware behaviour      | `groups.ts` helper + the store write that applies it + `check-groups.mjs`      | [`editor-groups.md`](editor-groups.md) §3                           |
| A new undoable mutator       | `store.ts` (snapshot internally) + every call site that does not               | [`editor-state-and-history.md`](editor-state-and-history.md) §2     |

## 6. Conventions this folder follows

- One contract per subsystem: `# Title`, a wrapped blockquote preamble naming what
  it owns and closing with the fix-the-code clause, a `---` rule, numbered `## N.`
  sections, and a closing `## N. Code map` table of `Concern | File`.
- Cross-references are written `docs/editor-x.md` §N. Section numbers restart per
  file, so the number is never optional.
- Code maps name files as backticks, never as links: on a published site a link
  out of `docs/` resolves to nothing.
- Gaps are stated in place rather than left implied — `editor-text-engine.md` §7,
  `editor-help-and-learn-mode.md` §11, `editor-render-contract.md` §10. Read those
  before describing the feature as working.
- The `title:` front matter exists for GitHub Pages only: Jekyll serves a Markdown
  file without front matter as raw text instead of rendering it.

## 7. Not covered by any contract here

No document in this folder names these, so nothing pins their behavior:

- `src/app/**` — the routes, and the host layer that gates the web CanvasKit load
  (`EditorScreenHost`, `EditorCanvasHost`, `components/skia/skia-canvas-bridge`).
- `src/editor/insert-sheet.tsx`, `src/editor/text-style-controls.tsx`,
  `src/editor/use-auto-save.ts`.
- `src/hooks/`, `src/haptics.ts`, `src/i18n/` beyond `strings.ts`.
- `src/components/ui/` beyond `icon-button.tsx`, plus `gallery/` and `onboarding/`.
- `src/theme/` beyond `tokens.ts`, `color.ts`, `fonts.ts`, `font-pins.ts`,
  `presentations.ts` and `remote-fonts.ts` — the visual language itself lives in
  [`../DESIGN.md`](../DESIGN.md).
- `src/storage/` beyond `settings.ts`, `thumbs.ts`, `font-pins.ts`,
  `project-schema.ts`, `remote-font-cache.ts`, `remote-font-catalog.ts` and
  `remote-font-registry.ts`.
