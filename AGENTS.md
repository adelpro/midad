# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Read the contract before editing the editor

`docs/` holds one behavior contract per editor subsystem. They record the
invariants and traps that are **not** visible from the code, so read the relevant
one before changing that area. When a document and the code disagree, fix the code.

| Editing                                                                                   | Read first                           |
| ----------------------------------------------------------------------------------------- | ------------------------------------ |
| `editor/store.ts`, history, z-order                                                       | `docs/editor-state-and-history.md`   |
| `editor/groups.ts`, group membership, `select` expansion                                  | `docs/editor-groups.md`              |
| `editor/hit-test.ts`, fit-to-view, selection chrome                                       | `docs/editor-coordinates.md`         |
| `EditorCanvas.tsx`, `render/offscreen.ts`, `export/svg.ts`, `skia/shapes*`                | `docs/editor-render-contract.md`     |
| `skia/text.ts`, `skia/use-text-layouts.ts`                                                | `docs/editor-text-engine.md`         |
| `text/clusters.ts`, `text/split.ts`                                                       | `docs/editor-split-and-rejoin.md`    |
| `use-object-gestures.ts`                                                                  | `docs/editor-gestures.md`            |
| `selection-actions.tsx`, pins, the rail                                                   | `docs/editor-selection-bar.md`       |
| `editor/color-picker-sheet.tsx`, `theme/color.ts`                                         | `docs/editor-color-picker.md`        |
| `theme/remote-fonts.ts`, `storage/remote-font-cache.ts`, `storage/remote-font-catalog.ts` | `docs/editor-remote-fonts.md`        |
| `shortcuts.ts`, `use-keyboard-shortcuts*`, `modifier-keys*`                               | `docs/editor-keyboard.md`            |
| `editor/help/**`                                                                          | `docs/editor-help-and-learn-mode.md` |
| selection semantics, multi-select, background flow                                        | `docs/editor-selection.md`           |
| `storage/**`, the `.midad` format, import/export                                          | `docs/storage-format.md`             |

## Checks

There is no test runner. `node scripts/verify.mjs` runs the typecheck, the lint,
the format check and all twelve checks **in parallel** — wall clock is the
slowest one — printing each task's own output and failing if any of them did.
Reach for it first; the individual scripts are the right tool when you already
know what you touched.

```bash
node scripts/verify.mjs          # everything, in parallel (also `yarn verify`)
node scripts/verify.mjs --serial # same, one at a time
```

The slow tasks keep a cache, so a re-run only redoes what changed:
`.cache/tsconfig.tsbuildinfo` (`"incremental": true` and `tsBuildInfoFile` in
`tsconfig.json`), `.eslintcache` (`--cache` on eslint, at the repo root) and
`.prettiercache` (`--cache-location` on prettier, at the repo root). All three
are gitignored — delete them to force a cold run. A
`tsconfig.json`/`eslint.config.js`/`.prettierrc.json` edit, a `yarn install` or a
large branch switch invalidates them for you.

Run one on its own when it covers what you touched:

```bash
npx tsc --noEmit                 # typecheck (incremental)
npx eslint src --cache --cache-location .eslintcache   # lint, cached
node scripts/check-clusters.mjs  # Arabic split segmentation + round-trip
node scripts/check-groups.mjs    # group membership + the whole-groups invariant
node scripts/check-handles.mjs   # selection-handle geometry in screen pt
node scripts/check-swipe.mjs     # gallery row swipe geometry + commit decision
node scripts/check-countdown.mjs # undo-snackbar countdown seconds + ring arc
node scripts/check-shortcuts.mjs # binding table + matcher + chord text
node scripts/check-help.mjs      # help catalog ↔ strings.ts ↔ shortcuts.ts
node scripts/check-fonts.mjs     # font family registry + fontAssets invariants
node scripts/check-remote-fonts.mjs # remote font keys + face status + Fontsource URLs
node scripts/check-glyphs.mjs    # ornament line weight shared across all renderers
node scripts/check-export-payload.mjs # export write-encoding decision
node scripts/check-color.mjs     # colour parsing + canonical hex normalisation
```

`verify` lints `src` and `scripts` alike. The two `no-undef` errors for `Buffer`
in the glyph tooling are gone — `eslint.config.js` declares `Buffer` as a readonly
global for `scripts/**/*.mjs` — so the suite reports a clean run.

Formatting is not part of that list. `prettier` **is** a devDependency, with
`format` / `format:check` / `format:fix` scripts (and CI runs `format:check`), so
reach for `yarn format:fix` rather than `npx prettier@3`. `.prettierrc.json` is
the single config — do not add a second `.prettierrc`, which would win the lookup
and silently drop every option in it. `.prettierignore` keeps formatting off
`android/`, `ios/` and the other generated trees (1235 files under `android/`
alone), which is where the time went; scope to the files you touched when you can.
`endOfLine` is `"auto"`, so the CRLF in `src/i18n/strings.ts` survives a rewrite.

`src/editor/shortcuts.ts` and `src/editor/help/catalog.ts` must declare **only
`import type`** (and `src/i18n/strings.ts` no imports at all) — the checks
transpile and evaluate them standalone, so a value import silently breaks them.
