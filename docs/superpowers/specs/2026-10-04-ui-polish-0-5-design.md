# UI polish for 0.5.0 — design

**Status:** proposed 2026-10-04
**Files:** `src/editor/font-picker-sheet.tsx`, `src/editor/EditorScreen.tsx`, `src/i18n/strings.ts`, `src/app/_layout.tsx`, `src/hooks/use-bootstrap.ts`, `src/components/ui/brand-loader.tsx`, `src/components/gallery/gallery-header.tsx`, `app.json`, `scripts/generate-icons.mjs`, `scripts/check-fonts.mjs`, `scripts/check-font-pins.mjs`, `docs/editor-font-loading.md`, `docs/editor-font-pins.md`

> This design covers four complaints from one round of use — the font picker's
> weight, the missing Arabic/Latin filter, the background tool's alignment, and
> the launch and gallery brand mark. It owns their decisions and nothing else:
> the placed-asset work (an image element and imported icons) is a separate
> release with its own spec because it changes the document schema. When this
> document and the code disagree, fix the code.

---

## 1. What is wrong, measured

Four independent defects, no shared cause, no schema change between them.

1. **The font picker is heavy.** `font-picker-sheet.tsx` renders one
   non-virtualized `ScrollView` with four stacked blocks — Pinned → **Arabic
   (22 families)** → **Latin (10)** → Google (only while typing). Each row is a
   bordered card carrying a 26 px specimen, a two-line caption and a 36 px pin,
   so the worst case is roughly 150–250 host views built eagerly. Latin sits
   under 22 Arabic rows.
2. **There is no script filter.** The `FontScript` tag (`'arabic' | 'latin'`)
   already exists and already splits the list into `fontSections`; what is
   missing is a control to show one script at a time.
3. **The background tool is start-aligned with no breathing room.** It is not a
   sheet — it is the context rail's scroll zone. `contextTrack`
   (`EditorScreen.tsx` §styles) sets `paddingHorizontal: 12` and nothing else,
   so `bgToolWrap` sits hard against the leading edge of a 56 dp rail.
4. **The brand mark is small and the launch cuts.** `app.json` sets the splash
   `imageWidth: 120`, and `splash-icon.png` is a padded square whose logo is only
   56 % of the frame, so the visible logo is about **67 dp** tall. In the
   gallery the header mark is `height={34}` (phone) → about **19 dp wide**. The
   native splash is a static PNG and `use-bootstrap` hides it at the exact
   moment the first route renders, so the arrival is a hard cut from a still
   frame. Dark mode reuses the black `#05060A` logo on `#111111`.

## 2. Decisions

| #   | Decision                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------- |
| D1  | The picker gets a three-way script filter — **All / Arabic / Latin** — as a segmented row above the search field.     |
| D2  | The filter's default is the active family's script, falling back to `arabic`. It is not persisted.                    |
| D3  | The filter applies to the **bundled** sections only; the Google section and the Pinned section are unaffected.        |
| D4  | Rows become a flat divided list instead of a stack of cards: 20 px specimen, hairline separators, tighter padding.    |
| D5  | The variant chips, the search box, the Pinned collapse and every accessibility label are unchanged.                    |
| D6  | The background tool's context zone is horizontally centred and given vertical padding, inside the existing 56 dp rail. |
| D7  | The splash asset is re-cropped tighter **and** `imageWidth` is raised; a light logo is generated for dark mode.        |
| D8  | The native splash hides as soon as the theme is known, and the animated `BrandLoader` covers the remaining font wait.  |
| D9  | The gallery header mark grows; the gallery keeps its skeletons and gains no loader.                                    |

## 3. The font picker

### The filter (D1, D2, D3)

A segmented control of three items sits above the search field, built from the
same three-button `Button` row `insert-sheet.tsx` already uses for its tabs
(variant `primary` when active, `secondary` otherwise, `selected` set) so the
picker gains no new control primitive. Labels are new strings:
`t.editor.allFonts`, and the existing `t.editor.arabicFonts` /
`t.editor.latinFonts`.

The state is `const [script, setScript] = useState<FontScript | 'all'>` seeded
per open from `familyForVariant(value)?.script ?? 'arabic'`. The default is
computed in an effect keyed on `visible`, alongside the existing query reset, so
`closeSheet` does not need to change.

The filter narrows the render, not the data: `fontSections` still partitions
`matches` over `(['arabic', 'latin'] as const)`, and the render becomes
`fontSections.filter((s) => script === 'all' || s.script === script).map(...)`.
Keeping `fontSections` and `fontSections.map` intact is deliberate —
`check-fonts.mjs` pins those exact tokens.

Two sections are deliberately outside the filter, and the doc records why:

- **Pinned** — a pin is cross-script by definition, and a pinned row is the only
  way back to a face whose script the filter is currently hiding
  (`docs/editor-font-pins.md` §3).
- **Google Fonts** — that section only exists while the search box is non-empty
  and is searched by name; hiding its rows by script would fight the query, and
  its rows already carry an Arabic-support badge.

### The density (D4, D5)

`styles.row` loses `borderWidth`, `borderRadius`, `paddingStart`/`paddingEnd`
and gains `borderBottomWidth: StyleSheet.hairlineWidth`, so the 32 families read
as one list. `styles.rowBody` keeps `flex: 1` and drops its vertical padding
from `spacing.sm` to `spacing.xs`. `styles.specimen.fontSize` drops 26 → 20.
The selected row keeps a `surfaceAlt` background (no border), and the pin button
keeps its size and `hitSlop`. `styles.row` keeps `flexDirection: 'row'` and the
file keeps using `paddingStart` elsewhere — both are pinned by
`check-font-pins.mjs`.

The Google rows keep their card treatment: they are a different kind of row
(a name plus a badge plus a weight-chip state machine) and flattening them would
lose the badge's visual anchor. This asymmetry is intentional.

## 4. The background context zone (D6)

The rail's height is **not** changed: `contextRail.height` is fixed at 56 so the
canvas does not reflow when the tool changes (the comment above the style says
this, and `use-object-gestures` depends on it). Centring and padding happen
inside the existing height.

A conditional variant is added to the context zone's content container style:

- `contextTrack` (base, unchanged) — `flexDirection: 'row'`, `alignItems: 'center'`,
  `gap: spacing.md`, `paddingHorizontal: spacing.md`.
- `contextTrackCentered` (new, applied when `tool === 'background'`) —
  `flexGrow: 1`, `justifyContent: 'center'`, `paddingVertical: spacing.sm`.

`bgToolWrap` keeps `flexDirection` / `alignItems` and gains
`gap: spacing.sm`; `colorStrip` already has that gap. With a 34 dp swatch strip
and 8 dp of vertical padding the content is 50 dp in a 56 dp track, so the
padding fits without clipping. The split-notice and selection-rail branches are
untouched — the variant only applies when the background tool owns the row,
which is also the only case where the selection rail is hidden
(`EditorScreen.tsx`, `tool !== 'background'`).

## 5. The launch and gallery brand mark (D7, D8, D9)

### The splash asset and its size (D7)

`scripts/generate-icons.mjs` is the single source for every raster icon, so the
re-crop happens there:

- `splash-icon.png` — `availRatio` 0.56 → **0.72** (still a padded 512² square,
  so the visible logo is 72 % of the frame instead of 56 %).
- `android-icon-foreground.png` — `availRatio` 0.56 → **0.60**. This is bounded:
  the Android adaptive-icon safe zone is 66/108 = **61.1 %** of the canvas, and
  a larger logo would be clipped by a mask. 0.60 is the largest value with
  margin.
- A new **`splash-icon-dark.png`** with a *light* logo. It is produced by
  rasterizing the same brand SVG and calling `.negate({ alpha: false })` on the
  logo buffer, which inverts RGB and preserves alpha, turning `#05060A` into
  white. `app.json`'s splash plugin gains `dark.image` pointing at it, so the
  dark splash is no longer a black mark on `#111111`.

`app.json` raises `imageWidth` 120 → **200**. Visible logo on Android goes from
about 0.56 × 120 = **67 dp** to about 0.72 × 200 = **144 dp**.

### The animated arrival (D8)

Today `useBootstrap` hides the native splash only when
`(fontsLoaded || fontError) && settingsHydrated`, so the splash covers the font
wait and the app cuts straight to the first route. The loader's pulse is
therefore never seen on the launch path, and
`docs/editor-font-loading.md` §5 records that as deliberate (spec D8 of the
lazy-fonts work).

This design supersedes that decision with a cheaper one that keeps its intent
("the pulse is an in-app cover, never the native splash") while making the
arrival animated:

- `useBootstrap` returns `hydrated` as well as `ready` and `error`, and hides
  the native splash when **`settingsHydrated`** is true, not when the fonts have
  loaded. The theme is known from that moment, so the cover cannot flash the
  wrong background — which is exactly why the hydration gate exists.
- `RootLayout` renders the `Stack` once `ready || error` (as today) and renders
  `<BrandLoader />` in a full-bleed wrapper while
  `hydrated && !ready && !error`. The cover is paper-coloured and the splash is
  paper-coloured, so the handoff is a mark that keeps breathing rather than a
  frame that is replaced.
- The cover's mark is `height={144}`, matching the splash's visible logo, so the
  mark does not change size at the handoff. The exact dp is verified on device
  and web.
- Nothing is deferred: the routes mount the moment they are ready, so the change
  adds **no** latency. On a warm start the cover is visible for a few frames;
  under Reduce Motion the mark rests and no loop runs, exactly as
  `BrandLoader` already behaves.

`docs/editor-font-loading.md` §5 and §3 are updated: the cover is now also the
launch cover, and the native splash's job ends at theme hydration.

### The gallery mark (D9)

`gallery-header.tsx` raises the mark from `isWide ? 38 : 34` to
`isWide ? 48 : 44`. The 44 dp header row and the 64 dp expanded header both have
room. The gallery's loading state keeps its `ProjectCardSkeleton`s and gains no
mark: a skeleton is the honest placeholder for content that is about to appear,
and a pulsing logo over six skeletons would be two competing animations.

## 6. Out of scope

- **Virtualizing the picker.** The 32-family filtered list is at most ~22 rows;
  the filter removes the need, and `check-fonts.mjs`'s string assertions would
  have to be rewritten for a `FlashList`. Revisit only if the bundled registry
  grows past roughly 60 families.
- **A native animated splash.** iOS cannot animate a launch screen at all, and
  Android 12+'s `windowSplashScreenAnimatedIcon` needs an animated-vector
  drawable that the Expo plugin does not emit. The animated cover is the only
  cross-platform answer, and it is what D8 delivers.
- **Re-cropping `icon.png`, `favicon.png` and the monochrome icon.** Only the
  splash and the adaptive foreground change.
- Any change to the font registry, `font-pins`, or the Google Fonts flow.

## 7. Checks and docs

- `scripts/check-fonts.mjs` and `scripts/check-font-pins.mjs` read
  `font-picker-sheet.tsx` as text and assert exact tokens. D1–D5 are chosen so
  that **no assertion has to change**: `SPECIMENS: Record<FontScript`,
  `SPECIMENS[family.script]`, `fontSections`, `f.script === script`,
  `(['arabic', 'latin'] as const)`, `fontSections.map`, `useFontPins`,
  `familyPinId`, `googlePinId`, `parseFontPinId`, `humanizeRemoteFontId`,
  `parseRemoteFontKey`, `t.editor.pinnedFonts`, `flexDirection: 'row'`,
  `paddingStart`, `pinnedCollapsed`, `t.editor.collapsePinned` and
  `t.editor.expandPinned` all survive. The plan verifies this rather than
  assuming it.
- New strings `editor.allFonts`, `editor.insert` (and, in 0.6.0,
  `editor.media`/`editor.image`) go in `src/i18n/strings.ts` in the interface and
  in both language blocks. `strings.ts` declares no imports.
- `docs/editor-font-loading.md` §3 and §5 gain the launch-cover change;
  `docs/editor-font-pins.md` §3 gains one sentence saying the pinned section is
  outside the new script filter.
- `docs/index.md` needs no new row: no new contract document is created.

## 8. Testing

There is no test runner. Verification is `node scripts/verify.mjs` (sixteen
tasks) plus the platform observations below, on web and on the Pixel emulator.

| Observation                          | Expected                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Open the picker with an Arabic face  | The filter defaults to Arabic; only the Arabic section renders; the Latin section is one tap away. |
| Switch to Latin, close, reopen       | The filter resets to the *active family's* script — Latin, because Latin is now selected.        |
| Search `noto` with Latin filtered    | Bundled matches narrow to the Latin section; the Google section still lists its hits with badges. |
| Row height                            | A row is visibly shorter than before and separated by a hairline, not a card border.             |
| Background tool                       | The swatch strip is horizontally centred in the rail with even space above and below.            |
| Rail does not resize                  | Tapping Background does not change the canvas size or the fit-to-view zoom.                      |
| Cold start on Android, light and dark | The splash mark is much larger, legible in dark mode, and hands off to the same-sized pulsing mark with no flash. |
| Gallery header                        | The mark is visibly larger than before.                                                          |
| Reduce Motion on                      | The launch cover shows a static mark; no loop runs; the routes still appear with no extra wait.  |

## 9. Code map

| Concern                          | File                                                    |
| -------------------------------- | ------------------------------------------------------- |
| Script filter state and control  | `src/editor/font-picker-sheet.tsx`                       |
| Row density and hairline divider | `src/editor/font-picker-sheet.tsx`                       |
| Filter labels                    | `src/i18n/strings.ts`                                    |
| Context-zone centring            | `src/editor/EditorScreen.tsx`                            |
| Splash and adaptive-icon assets  | `scripts/generate-icons.mjs`, `app.json`                 |
| Splash hide timing               | `src/hooks/use-bootstrap.ts`                             |
| Launch cover                     | `src/app/_layout.tsx`                                    |
| The pulse itself (unchanged)     | `src/components/ui/brand-loader.tsx`                     |
| Gallery mark size                | `src/components/gallery/gallery-header.tsx`              |
| Pinned section vs the filter     | `docs/editor-font-pins.md` §3                            |
| Launch-cover contract            | `docs/editor-font-loading.md` §3, §5                     |
| Executable specs                 | `scripts/check-fonts.mjs`, `scripts/check-font-pins.mjs` |
