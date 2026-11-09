# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Read the contract before editing the editor

`docs/` holds one behavior contract per editor subsystem. They record the
invariants and traps that are **not** visible from the code, so read the relevant
one before changing that area. When a document and the code disagree, fix the code.

| Editing                                                                                                                                                                                  | Read first                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `editor/store.ts`, history, z-order                                                                                                                                                      | `docs/editor-state-and-history.md`    |
| `editor/groups.ts`, group membership, `select` expansion                                                                                                                                 | `docs/editor-groups.md`               |
| `editor/hit-test.ts`, fit-to-view, selection chrome                                                                                                                                      | `docs/editor-coordinates.md`          |
| `EditorCanvas.tsx`, `render/offscreen.ts`, `export/svg.ts`, `skia/shapes*`                                                                                                               | `docs/editor-render-contract.md`      |
| `skia/text.ts`, `skia/use-text-layouts.ts`                                                                                                                                               | `docs/editor-text-engine.md`          |
| `text/clusters.ts`, `text/split.ts`                                                                                                                                                      | `docs/editor-split-and-rejoin.md`     |
| `use-object-gestures.ts`                                                                                                                                                                 | `docs/editor-gestures.md`             |
| `selection-actions.tsx`, pins, the rail                                                                                                                                                  | `docs/editor-selection-bar.md`        |
| `editor/color-picker-sheet.tsx`, `theme/color.ts`                                                                                                                                        | `docs/editor-color-picker.md`         |
| remote fonts (`theme/remote-fonts.ts`, `storage/remote-font-*`, picker Google Fonts section, missing-font banner)                                                                        | `docs/editor-remote-fonts.md`         |
| font pins, the picker's Pinned section                                                                                                                                                   | `docs/editor-font-pins.md`            |
| when a bundled face loads, the core/display split, the cover, the loader (`theme/fonts.ts`, `storage/bundled-font-registry.ts`, `editor/skia/text.ts`, `components/ui/brand-loader.tsx`) | `docs/editor-font-loading.md`         |
| `shortcuts.ts`, `use-keyboard-shortcuts*`, `modifier-keys*`                                                                                                                              | `docs/editor-keyboard.md`             |
| `editor/help/**`                                                                                                                                                                         | `docs/editor-help-and-learn-mode.md`  |
| selection semantics, multi-select, background flow                                                                                                                                       | `docs/editor-selection.md`            |
| `storage/**`, the `.midad` format, import/export                                                                                                                                         | `docs/storage-format.md`              |
| `editor/skia/image-shape.ts`, `editor/skia/icon-shape.tsx`, `editor/icons/**`                                                                                                            | `docs/editor-render-contract.md` §5.1 |

## Checks

There is no test runner. `node scripts/verify.mjs` runs the typecheck, the lint,
the format check and all thirteen checks **in parallel** — wall clock is the
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
node scripts/check-font-pins.mjs  # pin-id namespaces (family:/google:) + the pinned list's ordering
node scripts/check-glyphs.mjs    # ornament styles (solid/outline/thin) + line weight shared across all renderers
node scripts/check-icons.mjs     # icon identity + licence record + the SVG-body-to-paths resolver
node scripts/check-storage.mjs   # the .midad container, the version reader, asset naming and copy paths
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

<!-- BEGIN EXPO AGENT CLI MANAGED BLOCK -->
<!-- Generated by `npx @expo/agent-cli agents:setup`. Everything inside the markers is overwritten on the next run. -->

## Expo project

- Project: midad
- SDK: 57.0.24
- Native: CNG (no native directories; they are generated by `npx expo prebuild`)
- Expo Go: compatible (Expo Go can run this project)
- Dev client: `expo-dev-client` is not installed

## Commands

For the operations listed below, use `@expo/agent-cli` in place of the equivalent commands elsewhere in this file or in loaded skills. Package installation still uses Expo’s SDK-compatible version resolution. Use `bunx` instead of `npx` when `bun.lock` is present.

Most commands take `--json` for a machine-readable report.

- `npx @expo/agent-cli status` — where the project is right now, and what would happen next: which sources changed since the last build, whether an update can ship over the air, and whether EAS already has a build for this fingerprint
- `npx @expo/agent-cli status --json` — the same report as one object, with the raw project probe under `probe`
- `npx @expo/agent-cli status --assert js-only` — a gate on what a change costs: exit 20 when it costs more than the class named, 22 when nothing could be measured, 0 otherwise
- `npx @expo/agent-cli dev --android` — get the app onto that platform's device: it prints the plan, then runs it. The platform flag (--ios, --android, --web) is required; add --plan to print the steps without running them
- `npx @expo/agent-cli start` — `expo start` and nothing else: a dev server no planning may touch
- `npx @expo/agent-cli install <pkg>` — install a package and report what it changes natively
- `npx @expo/agent-cli install --fix` — fix incompatible package versions using Expo's SDK-compatible version resolution
- `npx @expo/agent-cli lint` — run the project's Expo lint command
- `npx @expo/agent-cli doctor` — diagnose dependency and configuration issues with expo-doctor
- `npx @expo/agent-cli typecheck` — run the TypeScript compiler of this project as a gate: exit 20 with the diagnostics, exit 0 when there are none. A bundle that builds and an app that does not throw do not cover this.
- `npx @expo/agent-cli runtime:eval <js>` — evaluate JavaScript in the running app
- `npx @expo/agent-cli runtime:errors` — collect the runtime errors of the running app
- `npx @expo/agent-cli navigate <route>` — open a route as a deep link on a device
- `npx @expo/agent-cli runtime:tree` — what is on the screen of the running app, by testID
- `npx @expo/agent-cli runtime:tap <testID>` — tap an element; `--verify` reports what changed
- `npx @expo/agent-cli runtime:type <text> --testID <id>` — type into an input
- `npx @expo/agent-cli skills:list` — the agent skills the installed packages ship
- `npx @expo/agent-cli new <dir>` / `npx @expo/agent-cli deploy` — create a project headlessly / deploy web and native
- `npx @expo/agent-cli smoke --android` — the whole gate in one command: the dev server bundles, the app is up, and nothing threw

## Expo docs

The full Expo docs for this project’s SDK can be local Markdown files.

- `npx @expo/agent-cli docs:sync` downloads them and prints two directories: all docs, and this SDK’s API reference. Grep those directories.
- `npx @expo/agent-cli docs:search <query>` returns ranked pages with file paths and line numbers.
  Links in the docs point to `https://docs.expo.dev/<path>.md`. To read one locally, open `<path>.md` in the docs directory that `docs:sync` printed.
  Prefer the local docs over web fetches of docs.expo.dev.

## Devices

Run `npx @expo/agent-cli dev` before `navigate`, `runtime:reload` or `runtime:stop`, or they refuse with `NO_BOUND_DEVICE` and name the command. Never boot, shut down or delete a simulator named `agent-cli …` yourself, and never kill an emulator instance started with `-read-only`; it may be bound to another worktree.

## Expo skills

For Expo or EAS work, start with the `expo-overview` skill when it is available in your agent’s skill list. It routes your goal to the relevant Expo or EAS skill. Then read any matching package skills listed below for guidance specific to the installed packages.

<!-- BEGIN EXPO PACKAGE SKILLS -->

## Package skills

No linked package skills are available.

Run `npx @expo/agent-cli skills:sync` after changing dependencies to refresh this index. Run `npx @expo/agent-cli skills:list` to see available package skills.
<!-- END EXPO PACKAGE SKILLS -->

Commands end with a `Suggested next:` section — suggested follow-up commands, not required steps. Run one only when it serves your current goal.
<!-- END EXPO AGENT CLI MANAGED BLOCK -->
