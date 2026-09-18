# midad

An Arabic calligraphy studio for iOS, Android and the web — built with
[Expo](https://expo.dev) and [Expo Router](https://docs.expo.dev/router/introduction/).

## Documentation

[`docs/`](docs/) holds one behavior contract per editor subsystem. Each records
what the code cannot tell you on its own — the invariants, the traps, and the
trade-offs that were decided once. When a document and the code disagree, fix the
code.

| Document                                                              | Covers                                               |
| --------------------------------------------------------------------- | ---------------------------------------------------- |
| [`editor-selection.md`](docs/editor-selection.md)                     | Select tool, multi-select, background image flow     |
| [`editor-state-and-history.md`](docs/editor-state-and-history.md)     | Store slices, undo/redo, `sizedObjects`, z-order     |
| [`editor-coordinates.md`](docs/editor-coordinates.md)                 | The four frames, fit-to-view, selection chrome       |
| [`editor-render-contract.md`](docs/editor-render-contract.md)         | Canvas ↔ PNG ↔ SVG agreement                         |
| [`editor-text-engine.md`](docs/editor-text-engine.md)                 | Arabic shaping, auto width, paragraph lifetime       |
| [`editor-split-and-rejoin.md`](docs/editor-split-and-rejoin.md)       | The cluster split/rejoin algorithm                   |
| [`editor-collections.md`](docs/editor-collections.md)                 | Collections: groups, split words, the collection bar |
| [`editor-groups.md`](docs/editor-groups.md)                           | Group membership and the whole-groups invariant      |
| [`editor-gestures.md`](docs/editor-gestures.md)                       | Tap/pan/pinch/rotate, resize, release settle         |
| [`editor-selection-bar.md`](docs/editor-selection-bar.md)             | The action rail, width budget, pins                  |
| [`editor-keyboard.md`](docs/editor-keyboard.md)                       | Binding table, matcher, chord text                   |
| [`editor-help-and-learn-mode.md`](docs/editor-help-and-learn-mode.md) | Help catalog, learn mode                             |

Also:

- [`DESIGN.md`](DESIGN.md) — the midad visual language (single source of truth).
- [`CHANGELOG.md`](CHANGELOG.md) — what changed, release by release.

## Get started

1. Install dependencies

   ```bash
   yarn install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

### Code quality and commits

This project uses Yarn, Prettier, ESLint, TypeScript, Husky, and Commitlint.
The format check covers repository configuration and documentation while the
pre-commit hook formats every staged source file.
Install [Gitleaks](https://github.com/gitleaks/gitleaks#installation) locally
before committing; the pre-commit hook scans staged changes for secrets.

```bash
yarn format
yarn format:check
yarn lint
yarn type-check
yarn build:check
yarn secrets:check
```

Commit messages must follow the Conventional Commits format, for example:
`feat(editor): add snap guides`. GitHub Actions runs the same checks, rejects
competing lockfiles, validates pull-request commit messages, and scans the
repository for secrets.

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **`src/app`** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction/).

### Other setup steps

- ESLint is configured in `eslint.config.js` — the flat config built on
  `eslint-config-expo` plus `eslint-config-prettier`. Run `yarn lint`.
- There is no test runner. `yarn verify` is the gate: it runs the typecheck, the
  lint and four standalone behaviour checks in parallel.

## Checking your work

`node scripts/verify.mjs` (or `yarn verify`) runs the typecheck, the lint and the four standalone check scripts **in parallel** and fails if any of them did. `--serial` runs them one after another when you want to read them in order.

```bash
yarn verify                      # everything, in parallel
yarn typecheck                   # tsc --noEmit, incremental
yarn lint                        # eslint src scripts, cached
node scripts/check-clusters.mjs  # Arabic split segmentation + round-trip
node scripts/check-groups.mjs    # group membership + the whole-groups invariant
node scripts/check-shortcuts.mjs # binding table + matcher + chord text
node scripts/check-help.mjs      # help catalog ↔ strings.ts ↔ shortcuts.ts
```

The first run of each is the slow one: the typecheck writes `.cache/tsconfig.tsbuildinfo` and the lint writes `.eslintcache` at the repo root, both gitignored, and later runs only redo what changed. Delete those two to force a cold run.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
