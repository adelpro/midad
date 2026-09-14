# Changelog

All notable changes to **midad** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Selection overflow sheet** — the actions that do not fit the selection bar,
  as square tiles carrying each action's glyph, its name and a pin, plus a
  permanent `⋯` control at the end of the bar and a `Selection bar → More` entry
  in the help reference.
- **Pinnable selection bar** — pin an action to the head of the bar (the one
  position the width budget can never cut) from the sheet's tile, and long-press
  a button in the bar to take it out again. The order is device-local, like the
  gallery's pins, so it never enters the project document.
- **Export & share (Phase 4):**
  - Offscreen PNG rasterizer mirroring the editor canvas (zIndex order,
    transforms, flips, centered shaped paragraphs) at any target resolution
  - Share-first export sheet: share image via the native system share sheet /
    Web Share API with automatic browser-download fallback, plus vector **SVG**
    export with embedded `@font-face` TTFs and `.midad.json` project-file export
  - Gallery thumbnails: generated on save into a platform-split thumbnail
    store; cards render real design previews with graceful placeholders
  - Project import: pick or drop a `.midad.json` file from the gallery
    (document picker on native, hidden file input on web) with schema
    validation and collision-safe ids
- **Canvas editor (Phase 3):**
  - Full object editor core on `react-native-skia`: fit-to-view canvas scaling,
    background colors, and an optional grid overlay
  - Arabic calligraphy text shaped via the Skia **Paragraph API** (HarfBuzz):
    correct contextual forms, ligatures, and RTL direction — bundled fonts are
    registered through a typeface provider
  - Gestures: tap-to-select, grab-and-drag any object (select-and-move in one
    gesture), pinch-to-scale, two-finger rotate; view coordinates map to design
    units through a shared fit viewport
  - Selection context bar: scale ±10%, rotate ±90°, horizontal flip, duplicate,
    bring-to-front / send-to-back, delete
  - Text tool sheet: add or re-edit text objects across the 8 calligraphy styles
  - Multi-level undo/redo (50 snapshots) with pre-mutation history semantics
  - Save to the versioned `.midad.json` project store
- **Web Skia bridge:** CanvasKit WASM now loads via `WithSkiaWeb` before any
  Skia component renders (`EditorCanvasHost` platform split: direct import on
  native, lazy bridge + spinner fallback on web); font assets normalized
  per-platform for Skia's `useFonts` (`{ uri }` wrappers on web)
- **Phosphor icon additions:** rotate (ArrowsClockwise/CounterClockwise) and
  layer order (ArrowUp/ArrowDown) mapped to `rotateCw`/`rotateCcw`/`layerUp`/
  `layerDown`
- **Phosphor icon system:** replaced the hand-rolled SVG icon set with
  `phosphor-react-native` as the single icon source across all platforms
  (iOS, Android, web) for a unified identity. `Icon`/`IconName` wrapper
  maps the app's icon vocabulary to Phosphor glyphs (regular/bold/fill
  weights).
- **Onboarding refinements:**
  - Step dots centered horizontally
  - Professional illustrations: large Phosphor glyph (PenNib / TextAa /
    Export) inside a hairline ring on a tinted disk, replacing the
    hand-drawn line art
  - Language picker redesigned as a refined segmented control
- **Multi-step onboarding** with self-coded pager, vector illustrations, and CTAs:
  - Three refined-approach steps: Compose (كوّن لوحتك بنفسك) → Fonts (خطوطٌ أصيلة
    من التراث) → Share (صدّر لوحتك وشاركها)
  - Custom line-art vector illustrations (`OnboardingArt`) per step, theme-aware
  - Self-coded step pager (`StepPager`) built on reanimated + gesture-handler —
    pan-to-swipe with snapping, RTL-aware, no third-party dependency
  - Step dots indicator (`StepDots`), skip link, per-step CTA with final «ابدأ»
  - Onboarding copy rewritten in refined formal MSA (per the fasaha skill)
- **Navigation shell (Phase 2):**
  - Onboarding screen: brand intro (Amiri wordmark), feature highlights, and
    Arabic/English language picker with RTL switching
  - Bottom tabs via `expo-router/js-tabs`: Gallery (لوحتي) and Settings (الإعدادات)
  - Gallery screen: FlashList two-column grid of saved designs, empty state with
    calligraphic glyph, "new design" flow that creates a project and opens the editor
  - Settings screen: language, appearance (System/Light/Dark manual override),
    and About section with version + font credits
  - Editor placeholder screen (`/editor`) — the canvas engine lands in Phase 3
- **Manual theme override:** `theme` preference (`system` | `light` | `dark`)
  persisted in settings; `useTheme()` honors it before falling back to the
  system scheme
- Arabic copy polished with the **fasaha** skill (imperative agreement, fluent
  phrasing, removed redundancy)

### Changed

- **Web shows no tooltips.** The hint bubble is native-only now: the same label
  is one tap away in learn mode, which is how the editor names its icon-only
  chrome everywhere else. A control that claims its own long-press — the
  selection bar's pin — suppresses the bubble as well, so one gesture keeps one
  meaning.
- **The selection bar's context rail has a top gap**, so its controls no longer
  sit flush against the canvas card. The gap lives inside the rail's fixed
  height, so the canvas box above it still cannot change under the user.
- React Compiler compliance across the onboarding pager and editor gesture
  hooks (shared-value writes annotated, ref/state access moved into the store);
  gallery project fetch restructured out of the synchronous render path
- **Editor resize handles are now axis-aware** (previously all eight handles
  performed the same centre-anchored proportional scale, so dragging a side
  handle resized the whole object and changed the font size):
  - **Corner handles** scale proportionally, pinning the opposite corner
  - **Top/bottom handles on text** change the font size, pinning the opposite edge
  - **Left/right handles on text** change the wrap width so the glyphs re-flow
    (narrowing can push a line onto two, widening can pull it back to one) while
    the font size stays put; the new `wrapWidth` field is optional, so existing
    `.midad.json` documents keep loading as auto-width text
  - Handle geometry is shared between the gesture hit-test and the drawn
    overlay, handle touch targets stay a constant size regardless of object
    scale, and the SVG export reproduces soft wraps via Skia's line metrics
    (falling back to explicit newlines if the metrics cannot be mapped)
- **Text width is resolved before shaping**, so the selection box always matches
  the glyphs. Auto-width text is measured unwrapped and then capped at the
  canvas, so a short caption's box hugs it exactly and an over-long line wraps
  at the canvas edge; a manual wrap width still takes precedence. This also
  removes a mismatch where the box was measured at the canvas width while the
  glyphs were laid out at the box width (which let centred text sit off-centre
  and let the measured height drift from the painted one).

### Fixed

- **Learn mode can explain the selection bar's "more tools" again.** The `⋯`
  control was bound through the same learn-mode binder as every other action, so
  while learning a tap explained _it_ instead of opening the sheet — leaving the
  thirteen actions behind it as the only part of the editor with no explanation
  on any surface. It is now resolved as a _disclosure_: it keeps working while
  learning and opens the overflow set as a centred, scrollable reference list
  (label, role, and its chord on the web, the same rows the help sheet draws)
  rather than as buttons whose every press would explain instead of act.
- **Selecting an object no longer resized the editor canvas.** The contextual
  bars (selection actions, parts strip, style navigator, split notice, colour
  swatches) were in-flow siblings under a `flex: 1` canvas, so every bar that
  mounted on a selection change took its height out of the canvas — and because
  `EditorCanvas` derives its fit-to-view from the measured wrapper, the whole
  design re-zoomed with it. They now float over the canvas stage as translucent
  cards, leaving the canvas box constant; the colour strips moved in with them,
  so switching tools no longer resizes it either.
- **The selection bar no longer hides its trailing controls — in either
  language.** It holds up to twenty buttons while a phone rail fits about seven,
  so the old `maxHeight: 104` plus `overflow: hidden` silhouetted the last few
  (delete, and the canvas-centring actions), and scrolling the row only moved
  the problem: in Arabic the hidden tail sits off the _left_ edge, where nothing
  signals that it exists. The bar now renders the highest-priority actions that
  fit and sends the rest to the labelled sheet above, so every action stays one
  tap away at any width. The order, the overflow set and all the copy live in
  `editor/selection-actions.tsx`, which reads them from the help table, and the
  rail measures both its own width and the width its parts/style/colour zone
  needs rather than assuming either. **The style navigator left the bar for the
  same reason:** its two arrows and name chip cost five of the seven slots a
  phone rail has, leaving room for two actions. The style panel now opens from
  a `Style` button at the head of the bar — the one control that could not
  afford to be truncated — and stepping through presets moved into the `⋯`
  sheet, where picking one from the panel's grid is still a single tap.
- **Text boxes were always one unit too narrow, so every auto-width text wrapped
  onto a second line** inside a container that looked too small. Skia truncates
  a paragraph's layout width to an integer, and the width was taken straight
  from `getLongestLine()` (a float), so shaping at it collapsed to its floor and
  re-wrapped the very line it was measured from. The resolved width is now
  rounded up, which keeps text that fits on one line on one line while a manual
  wrap width and the canvas cap still behave as before.
- **The rotation grip could swallow the top resize handle**, so vertical resize
  silently became rotation on any object scaled below ~0.8 (and on very small
  objects it could steal the side handles too). The grip's touch radius is a
  constant size on screen while its distance from the box was expressed in local
  units, so the two collided as the object shrank. Handle padding and the grip
  gap are now authored in design units and converted through the object's scale,
  exactly like the touch radii, and the closest target wins — verified for
  object scales from 0.1 to 5 and rotations of 0°, -30° and 45°.

- **Rotation grip** on the selection overlay: a handle on a stalk above the box
  that turns the object about its centre, so rotation no longer requires the
  two-finger gesture or the ±90° buttons. The angle accumulates in small
  wrapped steps, so a drag can travel past 180° without the object snapping to
  its mirrored angle. Available for every object type, and it rotates with the
  object because it is drawn in the object's own frame.
- **Fit to text** action in the selection context bar (text objects only),
  which clears a manual wrap width so the object returns to auto width and hugs
  its content again.
- `fitText` icon (`ArrowsInLineHorizontal`) added to the icon set.
- Full **dark mode** support:
  - Warm charcoal/ink palette that inverts the paper–ink relationship
  - `useTheme()` hook resolving the active palette from the system color scheme
  - All UI components (Button, Card, Tag, Kbd, Divider, IconButton, Icon, Sheet, EmptyState)
    are theme-aware
  - `userInterfaceStyle` set to `automatic` so the app follows light/dark system preference

## [0.1.0] - 2026-08-21

### Added

- Expo SDK 57 project scaffold (TypeScript, expo-router, new architecture, React Compiler)
- Yarn as the package manager (`yarn.lock`)
- Brand identity:
  - `midad` logo SVG (`assets/brand/midad.svg`)
  - App icon, splash, Android adaptive icons generated from the logo
  - Adaptive SVG favicon (light/dark aware) served on web
- 18 open-source Arabic & Latin fonts (OFL): Amiri, Aref Ruqaa, Noto Naskh/Kufi Arabic,
  Reem Kufi, Lemonada, Cairo, Geist
- Warm-ink minimalist design system:
  - Design tokens (palette, spacing, radii, motion, type scale) in `src/theme`
  - Font registry and semantic font roles for Arabic/English
  - UI component set: Button, Card, Tag, Kbd, Divider, IconButton, Icon (curated stroke set),
    Sheet, EmptyState
- i18n foundation:
  - Arabic-first interface with RTL support, English toggle
  - `I18nProvider` / `useT()` and language persistence
- Storage layer:
  - Settings store (language, default canvas) via AsyncStorage + zustand
  - Versioned `.midad.json` project schema
  - Platform abstraction for web: project persistence via localStorage,
    export via browser download / Web Share API
- Editor foundation:
  - `react-native-skia` with web bridge (`WithSkiaWeb` + CanvasKit WASM in `public/`)
  - Correct Arabic text shaping via the Skia Paragraph API
- Brand welcome screen with Amiri wordmark

### Changed

- Removed Expo template demo code, demo assets, and unused dependencies
- Migrated package management from npm to yarn

## [Unreleased] template history

- This project was scaffolded from the Expo default template (SDK 57).
