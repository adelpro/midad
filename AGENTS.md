# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Read the contract before editing the editor

`docs/` holds one behavior contract per editor subsystem. They record the
invariants and traps that are **not** visible from the code, so read the relevant
one before changing that area. When a document and the code disagree, fix the code.

| Editing                                                                    | Read first                           |
| -------------------------------------------------------------------------- | ------------------------------------ |
| `editor/store.ts`, history, z-order                                        | `docs/editor-state-and-history.md`   |
| `editor/groups.ts`, group membership, `select` expansion                   | `docs/editor-groups.md`              |
| `editor/hit-test.ts`, fit-to-view, selection chrome                        | `docs/editor-coordinates.md`         |
| `EditorCanvas.tsx`, `render/offscreen.ts`, `export/svg.ts`, `skia/shapes*` | `docs/editor-render-contract.md`     |
| `skia/text.ts`, `skia/use-text-layouts.ts`                                 | `docs/editor-text-engine.md`         |
| `text/clusters.ts`, `text/split.ts`                                        | `docs/editor-split-and-rejoin.md`    |
| `use-object-gestures.ts`                                                   | `docs/editor-gestures.md`            |
| `selection-actions.tsx`, pins, the rail                                    | `docs/editor-selection-bar.md`       |
| `shortcuts.ts`, `use-keyboard-shortcuts*`, `modifier-keys*`                | `docs/editor-keyboard.md`            |
| `editor/help/**`                                                           | `docs/editor-help-and-learn-mode.md` |
| selection semantics, multi-select, background flow                         | `docs/editor-selection.md`           |

## Checks

There is no test runner. These standalone scripts are the safety net — run the
one that covers what you touched:

```bash
npx tsc --noEmit                 # typecheck
npx eslint src                   # lint (src alone; scripts has 2 known errors)
node scripts/check-clusters.mjs  # Arabic split segmentation + round-trip
node scripts/check-groups.mjs    # group membership + the whole-groups invariant
node scripts/check-shortcuts.mjs # binding table + matcher + chord text
node scripts/check-help.mjs      # help catalog ↔ strings.ts ↔ shortcuts.ts
```

`src/editor/shortcuts.ts` and `src/editor/help/catalog.ts` must declare **only
`import type`** (and `src/i18n/strings.ts` no imports at all) — the checks
transpile and evaluate them standalone, so a value import silently breaks them.
