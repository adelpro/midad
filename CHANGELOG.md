# Changelog

All notable changes to **midad** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
- React Compiler compliance across the onboarding pager and editor gesture
  hooks (shared-value writes annotated, ref/state access moved into the store);
  gallery project fetch restructured out of the synchronous render path

### Added
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