# Changelog

All notable changes to **midad** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.0-rc.1] - 2026-10-05

**0.6.0-rc.1 also carries the 0.5.0 development milestone, which was transitional
and was never published.** The script-filtered font picker, the flattened picker
rows, the centred background rail and the continuous launch brand mark were built
under 0.5.0 on `develop` and folded into this release rather than cut as a version
of their own, so they are listed below and no `v0.5.0` tag exists.

### Added

- **A photo can be placed on the canvas as an element.** Until now the only image a
  design could hold was the canvas background, and the tool rail's image button was
  that background's picker — so "add an image" was not hidden, it did not exist. An
  image is now an object like a shape: place it from the Insert sheet's new **Media**
  tab, then move, scale, rotate, flip, fade, reorder and delete it, and group it with
  anything else. Its frame follows the picture's own aspect rather than letterboxing
  it into a square, and its bytes are stored as a named entry in the design's
  package, so a design can hold several.
- **An icon can be imported from an open icon set and inked.** The same Media tab
  searches the Iconify catalogue and places a pictogram as **vector** art: the
  geometry is resolved when it is imported and stored in the document, so the export
  scales without blur, the icon takes the design's ink like a glyph, and a design
  that names an icon opens with no network at all. Only monotone sets whose icons are
  **filled paths** are offered — a set with baked colours cannot be inked, and a
  stroke-outlined set would import as a solid silhouette, which is why Tabler and
  Lucide wait for stroke rendering. A set the picker will not offer, or an icon whose
  shapes cannot be stored as paths, is shown disabled with the reason rather than
  approximated. Four sets are allowlisted (Material Symbols, Material Design Icons,
  Phosphor, Bootstrap Icons), each with its licence recorded in `THIRD-PARTY-ICONS.md`
  and pinned to `src/theme/icon-sets.ts` by `scripts/check-icons.mjs`.
- **The icon picker remembers what you place, and never opens blank.** Before a
  search the Icons block shows the icons this device has inserted — geometry included,
  so each draws and re-inserts with no network — under a **Recent** heading, or a
  shipped **Suggested** set on a fresh install. Searching streams each row's resolved
  geometry into a fixed preview tile, so a hit can be judged before it is placed.
  Every recent carries an × that forgets it, the list has a **Clear recents** action,
  and the recents are device-local, so they never enter the document.
- **An opacity slider** for a placed asset, in the selection rail.
- **The Insert sheet's wait states and its tab swap are animated.** A search in
  flight and a gallery load animate in place rather than leaving the sheet mute,
  and switching between its tabs is a transition rather than an instant swap.
- **A contract for the two new kinds** (`docs/editor-render-contract.md` §5.1).

### Changed

- **The font picker filters by script.** Its bundled list had grown to
  thirty-two families across two scripts, and the two sections were stacked:
  reaching a Latin face meant scrolling past twenty-two Arabic rows. A three-way
  **All / Arabic / Latin** control now sits above the search field and opens on
  the script of the family already in use, so the list a design needs is the one
  on screen. The filter covers the bundled sections only — the pinned rows stay
  visible because a pin is cross-script and is the way back to a hidden face, and
  the Google Fonts section stays because it is driven by the search box.
- **The picker's rows are one list instead of a stack of cards.** The bundled
  rows lose their borders and their 26 px specimens and sit behind hairline
  separators, so thirty-two families read as a list rather than thirty-two
  panels. The Google rows keep their card: they carry a download state machine
  and an Arabic-support badge, and that difference is worth the border.
- **The background tool's controls are centred in the context rail.** The rail
  is a fixed 56 dp because resizing it re-runs the canvas fit-to-view, so the
  centring and the padding live inside that height rather than by growing it.
- **The launch is one continuous brand mark.** The splash hid only once the core
  faces had loaded, so the arrival was a still frame replaced by a route. It now
  hides as soon as the persisted settings hydrate — which is what decides the
  theme, so the cover can be painted in the right colour — and the loader that
  already covers a design's font wait covers the launch's as well. It unmounts on
  the same transition that mounts the routes, so nothing is deferred and no wait
  is added. This supersedes the lazy-fonts decision that kept the pulse off the
  launch path; `docs/editor-font-loading.md` §3 and §5 record the change.
- **The splash and launcher marks are bigger, and the splash has a dark
  variant.** The visible logo was about 67 dp and the dark splash drew the brand's
  `#05060A` on `#111111`, which is to say it drew nothing. The splash asset is
  cropped tighter (0.72 of its frame, from 0.56), `imageWidth` is 200 (from 120),
  and a light-logo asset serves dark mode. The gallery header's mark grows with
  them.
- **The `.midad` container is version 3, and version 2 is still read.** A v2 document
  has exactly one image slot and no object asset entries, so placed images are what
  moved the version. `normalizeProjectVersion` accepts 2 or 3 and normalizes to 3,
  and it is called by all three load paths — so a design already on a device keeps
  working. Without that reader, bumping the version would have hidden every existing
  design, because the gallery treats a refused document as absent. A v1 archive, a
  future version and a corrupt file are still refused.
- **The font-style rail action and the new opacity action share a rail slot.** They
  can never both apply — one is text-only, the other is a placed asset — so the
  change spends no width on a rail that truncates on a phone.

### Fixed

- **An image's `imageUri` can no longer leak into `design.json`.** The in-memory data
  URI is stripped on every write for the background _and_ for every placed image; a
  surviving one would have re-serialised each image's full base64 payload on every
  autosave.
- **A placed image sits centred in its own frame.** The canvas renderer was the one
  site that drew the picture from the object's corner instead of its centre, so it sat
  half a box down and to the right of its own selection border; the PNG and SVG paths
  already applied the `-box/2` shift, and the canvas now agrees with them.
- **A monotone icon whose paths spell `fill="currentColor"` imports again.** The ink
  guard tested for the mere presence of a `fill`/`stroke` attribute, which refused
  `currentColor` and `none` — the tokens that mean "the design's ink" and "no paint" —
  and so rejected whole monotone sets while still listing their rows as available. It
  now tests the paint **value**: a literal colour is refused, the design's ink is
  taken.
- **The About page shows the developer's email instead of the Android package id.**
  It named `com.adelpro.midad` where a person looks for a way to reach the author; it
  now gives the email, in both languages.
- **A script filter that hides every bundled match now says so.** Filtering to Latin
  and typing a query that only matches Arabic families left a silently blank list; the
  picker shows the empty state instead.
- **The stroke-outlined icon sets are no longer offered.** All three renderers and
  the row preview draw a path by filling it, so a Tabler or Lucide icon imported as a
  solid silhouette rather than the outline it showed. Both are removed from the
  allowlist and the licence record until stroke rendering exists — an icon is refused
  rather than drawn wrong.

## [0.4.0] - 2026-10-04

**0.4.0 is 0.4.0-rc.1 promoted to a stable release — no app code changed
between the two.** The release candidate carried the ten bundled Latin faces,
the core/display font split with the cover-then-open loader, the picker's
per-script specimens and sections, and the universal sheet with its web width
cap; its section below is the record of all of it. This entry exists so the
release reads as a stable version in the log, and nothing moved in the
repository around it.

## [0.4.0-rc.1] - 2026-10-04

### Added

- **A soft-pulsing brand loader covers the wait before the editor can draw.**
  Opening a design now loads the calligraphic faces that design names _before_
  anything reaches the canvas, and a paper cover with the brand mark breathing on
  a 900 ms cycle holds the screen for that window — a gentle scale/opacity
  vibration, not a progress bar and not a path-drawing animation. It is neither
  Skia nor an SVG draw on purpose: web needs CanvasKit loaded before Skia can be
  touched at all, and a stroke-draw is web-only on `react-native-svg`, so a
  transform pulse is one implementation on web, Android and iOS. Reduce Motion
  skips the loop and rests the mark at scale 1.
- **A contract for when a bundled face loads** (`docs/editor-font-loading.md`),
  covering the core/display split, the loaded-set registry, the cover-then-open
  policy, and the two costs the design knowingly keeps.
- **Ten Latin calligraphic faces, bundled.** Latin was reachable only as the two
  UI sans faces that ship for the interface, and through a Google Fonts
  download. Ten OFL families now ship with the app — Pinyon Script, Great Vibes,
  Allura, Tangerine, Parisienne, Yellowtail, Sacramento, Dancing Script, Pacifico
  and EB Garamond — spanning formal copperplate through to old-style serif, so
  picking a Latin face means choosing a hand the way it does in Arabic. They are
  display-only like the Arabic calligraphic set, so they cost nothing at cold
  boot, and the eight-face core is unchanged.
- **The font picker sections itself by script** and shows each face in a specimen
  written for the script it covers — `Affection` for the Latin faces, chosen for
  its `ff` ligature and tall `f` ascender rather than `Lorem ipsum`. The picker
  previously rendered one Arabic phrase for every family, which was invisible
  while every bundled face was Arabic and useless the moment one was not.

### Changed

- **The app boots on eight font faces instead of thirty-seven.** The launch
  waited on the entire bundled registry while the first screen only ever draws
  Cairo, Amiri and Geist — a real wait for a benefit nobody could see. The
  registry is now split: those eight gate the splash, and the twenty-nine
  calligraphic faces load on demand. A design names its own faces, they are
  loaded behind the loader, and the editor is not allowed to paint until the
  typeface provider actually holds every one of them — so a Gulzar design never
  flashes a frame of Amiri on the way in. Opening the font picker warms the rest
  in the background, and each specimen repaints as its face arrives.
  Measured on a real cold page load of the web build: the gallery now fetches
  **8** font files where it fetched all 37, and a document that names two
  calligraphic faces fetches **10** — the same eight, plus exactly the two it
  needs. The trade-offs that remain are written down rather than left to be
  rediscovered: a warm open still shows the loader for ~700 ms on web while the
  provider rebuilds, and web fetches each face twice (once for `@font-face`, once
  for Skia). Both are render-contract changes to fix properly, so both are
  deferred.
- **The Pro gate design spec was reworked in a pricing session, and its
  implementation plan is now marked stale.** Ads with a Pro unlock were proposed
  and rejected — they do not reach this app's scale, they work against the
  export-and-share loop that is the whole growth channel, and they would trade
  the "your design data never leaves your device" claim for an ad-tracking
  identity before there is a user base to track. **Google Fonts moved into the
  gate** as a five-face allowance rather than a hard lock: the catalogue stays
  browsable and only the download is metered, which puts the upsell at the
  moment of peak intent and lands on a single call site. **Export quality**
  (resolution, JPEG, transparent PNG) replaced cleanliness as the headline Pro
  benefit, because every PNG is currently hard-coded to 2048 px and that gap
  costs nothing to sell. No app code changed, and none of the decisions are
  approved — the spec's open-questions section was restructured into settled
  and open, and the plan is not to be executed as written.

### Fixed

- **Splitting a word in a Latin face silently mangled it.** This was reachable
  before any Latin face shipped — type Latin in Cairo and split it today — but
  the bundled set was all-Arabic, so nothing in the picker led anyone to it. The
  split contract justifies separating a word by the shape of its letters, and
  that argument only holds for a _connected run_; the document said so nowhere,
  and the executable spec asserted the Latin behaviour as correct. A Latin
  cluster is not a connected run, so per-letter splitting severs the kerning and,
  in a script face, the connections that _are_ the typeface — producing parts
  that are placed correctly and shaped wrongly. Splitting a Latin face is now
  refused up front, and the control stays pressable and explains itself rather
  than silently doing nothing or vanishing from the bar. The contract now states
  the precondition it had been assuming. Splitting **per word** would satisfy the
  same precondition and is worth doing as its own feature; keeping ligatures
  together needs shaped glyph runs from the RN Skia binding, which is unverified.
- **The font picker listed the same family twice.** Searching for a family that
  ships with the app _and_ exists on Google Fonts — Amiri, Reem Kufi, Gulzar —
  showed one row under the bundled list and another under "Google Fonts", with
  no indication they were the same thing. The Google section now hides a family
  the app already ships, but only when the bundled copy covers every weight
  Google offers: eight families are kept reachable because Google genuinely
  widens them (El Messiri, Kufam, Lateef, Lemonada, Marhey, Mirza, Reem Kufi,
  Scheherazade New). Hiding on name alone would have removed those eight from
  the picker entirely.

## [0.3.0] - 2026-09-30

**0.3.0 is 0.3.0-rc.1 promoted to a stable release — no app code changed
between the two.** The release candidate carried the collections, the `.midad`
v2 container, Save to Photos, pinned fonts and the rest of the notes below; this
entry records only what moved in the repository around it.

### Changed

- **The dated design specs and implementation plans under `docs/superpowers/`
  are tracked again.** They had been caught by the skill scratch ignore, so a
  plan could vanish in a stray `git clean` the moment it left the working set.
  The `specs/` and `plans/` directories are re-included by name; the ledger and
  briefs beside them stay ignored.
- The **Pro entitlement and watermark gate** now keeps its design spec
  (`docs/superpowers/specs/2026-09-26-pro-gate-design.md`) and its
  implementation plan (`docs/superpowers/plans/2026-09-26-pro-gate.md`) in the
  tree. Nothing in this release implements them — the plan is parked, not
  started.
- `AGENTS.md` names `scripts/check-font-pins.mjs` beside the other twelve
  checks, so the contract table and the verify suite agree again.

### Removed

- The implementation plans for the features this release shipped — flip
  vertical, the eight-family calligraphic batch, the colour picker, the Google
  Fonts runtime and font pins — are gone from `docs/superpowers/plans/`. Their
  design specs stay, and each feature's contract in `docs/` is the durable
  record.

## [0.3.0-rc.1] - 2026-09-27

### Added

- **Collections: a group and a split word are now one concept.** Select two or
  more objects and tap **Group** (or `Ctrl/Cmd+G`) and they become one element:
  tapping any member selects them all, and they move, duplicate, restack, delete,
  restyle and now **scale and rotate** together. A split word is a collection too,
  so it can be moved, scaled and rotated whole — and tapped again to step back
  inside and edit one letter.
- **Collection handles.** A whole selection draws one box with eight handles and a
  rotate grip: corners and edges scale the collection about the opposite edge, the
  grip turns it about its centre, and the rotation snaps to the 45° multiples like
  an object's does.
- **A collection bar** on the canvas replaces both the split-only parts strip and
  the count badge that used to head the selection rail. One anchored surface
  carries the head — the element count, or which member you are on while inside a
  collection, with the way back out — and the member track: a tile per member in
  reading order, with prev/next stepping, a text member showing its own glyph, and
  an index caption so two tiles of the same kind can still be told apart. It sits
  above the frame, flipping below it when the frame is at the top of the canvas.
- **Save to Photos** (native only). The export sheet can write the design straight
  into the device photo library next to Share image / Export SVG / Export project
  file. It asks for **add-only** access — saving never needs read permission — and
  a denied permission reports itself in the sheet instead of failing silently.
- **The status bar follows the app's own theme**, not the system one. The
  light/dark choice is an in-app setting here, so the bar now matches it.
- **Pinned fonts.** Every family row in the font picker now carries a pin, and
  pinned families collect into a **Pinned** section at the top of the picker.
  The section collapses to a single header row so it can be shut out of the way,
  and the pinned set, the pin order and the collapsed state all persist on
  device. Nothing here enters the project document, so a `.midad` is still only
  the design. Remote Google Fonts pin the same way — and because a family can
  arrive either bundled or downloaded, pin ids are namespaced (`family:amiri`
  vs `google:amiri`) so the two stay distinct instead of collapsing into one
  row. A pinned remote row derives its display name from the id and lists only
  the weights actually installed.

### Changed

- **The project file is a `.midad` container now, and the format is v2.** A
  design is a ZIP holding `design.json` plus its background image as raw bytes,
  instead of one JSON with the image inlined as a base64 `data:` URI. The image
  no longer pays a ~33% base64 tax, and the document stays small enough that
  autosave no longer re-stringifies a multi-megabyte file on every quiet period.
  An exported design is one self-contained `.midad` that opens in any zip tool,
  and import reads it back on native and web alike. **This is a breaking change:
  designs saved by earlier versions do not open.** There is no migration path —
  v1 documents, the old `.midad.json` files and their `.index.json` are simply
  ignored. On device a design is now a folder (`midad-projects/<id>/`); on web it
  is a key per file, because `localStorage` is string-only.
- **The selection rail is actions only.** The member track left it for the
  collection bar, so the rail no longer shares its width budget with navigation:
  on a 390pt phone with a three-part word selected it went from `fit = 3` — three
  actions, plus a track scrolled one-and-a-half tiles deep — to **7 actions** with
  every tile readable. The count badge no longer costs a slot either, and an empty
  context zone is finally charged nothing: the zone's scroller reported its own
  container padding as content, so roughly one button's width was being spent on
  nothing in every state.
- The rail's scale, rotate and flip buttons act on a whole selection as a unit:
  they orbit and scale about the selection's centre instead of overwriting every
  member's own value from the primary object.
- **Learn mode** now teaches the collection gestures — its canvas legend lists the
  collection handles, how to enter a collection and how to leave one — and the
  collection bar's tiles and arrows explain themselves on tap instead of stepping.
- **The typecheck now fails on an unused local or parameter.**
  `noUnusedLocals` + `noUnusedParameters` are on in `tsconfig.json`, so dead
  bindings cannot creep back in. The tree was already clean; the new gate caught
  one import orphaned during this cleanup.

### Removed

- **The `.midad.json` format and the project index.** A design is a `.midad`
  container now, and the gallery discovers designs by enumerating the store
  rather than reading an `.index.json` that could disagree with it.
- **`outline` and `locked` are gone from the project schema and every path that
  carried them.** `outline` was the worse of the two: it was plumbed into the
  Skia layout and the layout signature, but only the SVG exporter ever rendered
  it and nothing in the UI ever set it — so canvas, PNG and SVG disagreed about
  any document that did. A file still carrying either key loads and ignores it.
- Dead code, found by walking the import graph rather than guessing:
  `src/storage/storage.ts` (a whole orphaned module), `ui/tag.tsx`,
  `ui/divider.tsx`, `renderIcon`, `useRegisteredFonts`, the `setName` mutator,
  `isPinned`, `projectFileUri`, three unused platform flags, nine unused icon
  variants, one unused `StyleSheet` entry, twelve incidental `export` keywords
  and the unreferenced barrel re-exports.
- `expo-device-hub` — a developer LAN-mirroring CLI that had no business in an
  app's `dependencies`. Removing it also dropped 43 transitive packages.
- A shadowing two-key `.prettierrc`, which was winning Prettier's config lookup
  and silently discarding every option in `.prettierrc.json`.

### Fixed

- **Saving to the photo library threw at runtime.** `photo-library.native.ts`
  called `MediaLibrary.saveToLibraryAsync` and
  `MediaLibrary.requestPermissionsAsync` — on SDK 57 those namespace methods are
  legacy shims that throw and point at `expo-media-library/legacy`. Rewritten
  against the current top-level `Asset.create` + `requestPermissionsAsync`, and
  the config plugin is now registered so the permission strings exist at all.
- `projectFileUri` was declared in the tsc shim and implemented in both platform
  files but called from nowhere; removed from all three.
- The cache paths named in `AGENTS.md` and `README.md` did not match the code;
  both now describe `.cache/tsconfig.tsbuildinfo`.
- A grouped word could not be edited letter by letter: selecting a part grew back
  to the whole group. A part is now entered individually.
- The collection chip measured its position against a box one padding-step larger
  than the canvas card, so its 4dp inset put it 8dp _outside_ the card it was
  labelling. The bar's layer is inset by the canvas wrapper's own padding, which
  is what makes the inset mean what it says.
- Pressing and dragging an object that was not yet selected used to move the
  _previously_ selected object: the drag origins were read from the store snapshot
  taken before the press.
- A pinned remote family that had not resolved from the catalogue yet was
  badged **no Arabic support**. The lookup collapsed "not known yet" into
  `false`, so the row asserted something untrue about the family. The badge now
  follows the resolved face and is simply absent until it arrives, and the
  row's accessibility label drops the badge suffix with it.

## [0.2.0-rc.1] - 2026-09-16

### Added

- **Help system fully wired.** A `?` button in the editor's top bar opens the
  full help reference (every tool, gesture and shortcut, in Arabic and English),
  and **Learn mode** is reachable from it: tap any control to read what it does
  instead of acting, with an explanation banner and a gesture legend floating
  over the canvas. On web, `Shift+/` (`?`) opens the reference from the
  keyboard too.
- **The intro shows once, and can be replayed from Settings.** Onboarding is a
  real route now (`/onboarding`) behind a device-local flag: the first launch
  lands on it, every launch after goes straight to the gallery, and a new
  **Intro** section in Settings re-opens it on demand. A replay leaves the flag
  set, so the intro never returns on its own, and the splash now waits for the
  settings store to rehydrate — otherwise the launch gate would decide against
  defaults and flash the intro at a returning user on every cold start.
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

- **The editor's font-size slider is the platform's slider now.** It is built on
  `@expo/ui`'s universal `Slider` — SwiftUI on iOS, Material 3 on Android, a real
  `<input type="range">` on web — so thumb physics, keyboard stepping (arrows,
  Home/End) and assistive-technology support come from the platform that renders
  it. The wrapper keeps the two things the platform does not: the geometric
  (`scale="log"`) track, expressed as a position↔value mapping, and the
  "one gesture, one undo step" bracket, now derived by treating the first change
  as the session opening and a short quiet gap as the settle. Two web gaps are
  corrected in a web-only stylesheet: the library styles everything but the box,
  leaving the input at the browser's ~129px default and 22px tall (under the 44pt
  target DESIGN.md §8 asks for), and it paints progress with a physical
  `to right` gradient, which under `dir="rtl"` fills the wrong side of a mirrored
  range input.
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

- **The Settings toggle held together in Arabic on web.** It is now `@expo/ui`'s
  universal switch — SwiftUI on iOS, Material 3 on Android, a DOM-backed switch
  on web — because react-native-web positioned RN's `Switch` thumb with a
  physical offset beside a logical one, so under `dir="rtl"` the on-state knob
  slid out of its track, and it read `activeThumbColor` rather than `thumbColor`
  for the on state, which painted the knob its own default teal.
- **Taps select on the canvas in every tool, not only Select.** The tap result
  was gated on the active tool while the pointer-down path was disabled with it,
  so in the Background, Colours, Text and Insert tools a tap did nothing at all —
  neither selecting nor clearing. Picking a background is the one flow that
  _leaves_ its tool selected, so the canvas read as dead immediately after
  choosing an image. A tap now resolves the selection whatever tool is active;
  dragging, resizing and rotating stay Select-only. The Colours and Background
  help roles were updated to match.
- **A tap and a drag now accept the same press.** The pointer-down path took a
  grab up to 8 local units outside an object's box while the tap hit-test used
  the bare box, so a tap just inside the visible edge could clear the selection
  where a 2px drag would have grabbed it. Both share `OBJECT_HIT_PAD`.
- **A stale selection flag can no longer swallow a tap.** `beginDrag` returned
  early without clearing `gs.selectionHandledOnDown` — a flag that only the
  trailing tap consumes, so a drag leaves it set. In a tool where the canvas is
  selectable but not draggable, that tap is now the one that selects rather than
  being spent on the stale flag.
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

- Removed Expo template demo code and unused dependencies. **Correction:** two
  template leftovers survived that pass — the Expo-branded iOS icon and the
  `expo-device-hub` dependency — both removed under \[Unreleased\].
- Migrated package management from npm to yarn

## [Unreleased] template history

- This project was scaffolded from the Expo default template (SDK 57).
