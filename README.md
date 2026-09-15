# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Documentation

[`docs/`](docs/) holds one behavior contract per editor subsystem. Each records
what the code cannot tell you on its own — the invariants, the traps, and the
trade-offs that were decided once. When a document and the code disagree, fix the
code.

| Document                                                              | Covers                                           |
| --------------------------------------------------------------------- | ------------------------------------------------ |
| [`editor-selection.md`](docs/editor-selection.md)                     | Select tool, multi-select, background image flow |
| [`editor-state-and-history.md`](docs/editor-state-and-history.md)     | Store slices, undo/redo, `sizedObjects`, z-order |
| [`editor-coordinates.md`](docs/editor-coordinates.md)                 | The four frames, fit-to-view, selection chrome   |
| [`editor-render-contract.md`](docs/editor-render-contract.md)         | Canvas ↔ PNG ↔ SVG agreement                     |
| [`editor-text-engine.md`](docs/editor-text-engine.md)                 | Arabic shaping, auto width, paragraph lifetime   |
| [`editor-split-and-rejoin.md`](docs/editor-split-and-rejoin.md)       | The cluster split/rejoin algorithm               |
| [`editor-gestures.md`](docs/editor-gestures.md)                       | Tap/pan/pinch/rotate, resize, release settle     |
| [`editor-selection-bar.md`](docs/editor-selection-bar.md)             | The action rail, width budget, pins              |
| [`editor-keyboard.md`](docs/editor-keyboard.md)                       | Binding table, matcher, chord text               |
| [`editor-help-and-learn-mode.md`](docs/editor-help-and-learn-mode.md) | Help catalog, learn mode                         |

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

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
