# Store screenshots

The App Store and Google Play sets are generated, not hand-made. `capture.mjs`
drives the web export with Playwright and shoots five real states — the editor,
the export sheet, the font picker, the split action and the gallery — at the two
native pixel sizes. [capture-flow](https://github.com/adelpro/capture-flow) then
frames each one and renders every store size from `shots.json`.

| Output                                  | Size        |
| --------------------------------------- | ----------- |
| `App Store/ar-SA/iPhone 6.9/01..04.png` | 1320 × 2868 |
| `Google Play/ar/Phone/01..04.png`       | 1080 × 1920 |

## Run it

```bash
yarn build:check                                       # dist/
PLAYWRIGHT_MODULE=/path/to/playwright \
  node ~/code/capture-flow/bin/capture-flow.mjs run --flow docs/store/flow.json
node ~/code/capture-flow/bin/capture-flow.mjs verify --dir docs/store/store-assets
```

`PLAYWRIGHT_MODULE` points at a `playwright` install; capture-flow ships its own
under `node_modules/`. `SHOT_URL` shoots another origin (the deployed site)
instead of the local export.

`capture.mjs` starts its own static server for `dist/`, so no second terminal is
needed and the shots never carry a hosting badge.

## What is checked in

- `capture.mjs`, `flow.json`, `shots.json` — the recipe, so a UI change can be
  re-shot instead of re-drawn.
- `captures/` and `store-assets/` are generated and gitignored. Delete them and
  re-run to rebuild from source.

The copy lives in `shots.json` (`*word*` marks the accent run) and goes through
the same Arabic review as the app's strings. `README`'s hero image is
`captures/iphone-01-editor.png`, downscaled to 680 px and committed as
`docs/media/editor.png`.
