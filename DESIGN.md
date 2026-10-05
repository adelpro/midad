# Design System: midad — مِداد

> **Single source of truth** for the midad visual language. Every screen,
> component, and generated artifact must comply. Implementation plans and design
> specs live in `docs/superpowers/{plans,specs}/`; tokens live in
> `src/theme/tokens.ts`. When this document and code disagree, fix the code.
>
> **Version 2 · 2026-10-05** — see "Version history" at the end.

---

## 1. Visual Theme & Atmosphere

**"A calligrapher's desk at dawn."** Warm bone paper, iron-gall ink, one drop of
saffron. The interface is the quiet room around the artwork — it never competes
with the canvas.

- **Density:** 4/10 — Daily App Balanced. Generous air around every group; never cramped, never hollow.
- **Variance:** 3/10 — Predictable & Calm. Symmetry and rhythm express discipline; asymmetry is reserved for the artwork itself.
- **Motion:** 6/10 — Fluid Springs. Everything moves like physical material: instant response on touch-down, spring settle, zero linear easing.
- **Emotional target:** calm confidence. The user should feel like a craftsman with excellent tools — never like a software user.
- **Language posture:** Arabic-first. RTL is the primary reading direction; English is a first-class guest, not an afterthought.

## 2. Color Palette & Roles

### Light — "Warm Paper"

| Name               | Hex       | Role                                                                     |
| ------------------ | --------- | ------------------------------------------------------------------------ |
| Bone Paper         | `#F7F6F3` | App background (`paper`)                                                 |
| Paper Bright       | `#FBFBFA` | Elevated background zones (`paperBright`)                                |
| Pure Surface       | `#FFFFFF` | Cards, sheets, docks (`surface`)                                         |
| Whisper Alt        | `#F9F9F8` | Subtle fills, secondary buttons (`surfaceAlt`)                           |
| Pressed Cloth      | `#EFEEE9` | Pressed states (`surfacePressed`)                                        |
| Iron Ink           | `#111111` | Primary text, solid CTAs (`ink`)                                         |
| Soft Iron          | `#2F3437` | Strong secondary text (`inkSoft`)                                        |
| Graphite           | `#787774` | Secondary text — AA on paper (`muted`)                                   |
| Faded Ash          | `#A9A69F` | Disabled, tertiary (`faint`)                                             |
| On Ink             | `#FFFFFF` | Text on an `ink` fill (`onInk`)                                          |
| Hairline           | `#EAEAEA` | Structural borders only (`border`)                                       |
| Strong Hairline    | `#D8D5CE` | Emphasis borders, dividers that must read (`borderStrong`)               |
| **Saffron Accent** | `#B0894F` | THE accent — selection rings, active tools, focus, undo links (`accent`) |
| Saffron Text       | `#956400` | Accent text on light bg (`accentText`)                                   |
| Saffron Wash       | `#F5EEE2` | Accent tint backgrounds (`accentSoft`)                                   |
| Oxblood            | `#9F2F2D` | Destructive only (`danger`), on `dangerBg` `#FDEBEC`                     |
| Success            | `#346538` | Confirmation (`success`), on `successBg` `#EDF3EC`                       |

Status pairs carry a tint + a text ink that clears AA on it: `paleRed`
`#FDEBEC`/`#9F2F2D`, `paleBlue` `#E1F3FE`/`#1F6C9F`, `paleGreen`
`#EDF3EC`/`#346538`, `paleYellow` `#FBF3DB`/`#956400`.

### Dark — "Warm Ink" (inverts paper↔ink)

`paper` `#16150F` · `paperBright` `#1D1B14` · `surface` `#211F18` · `surfaceAlt`
`#26241C` · `surfacePressed` `#2E2B22` · `ink` `#F2EFE7` · `inkSoft` `#D8D4C9` ·
`muted` `#9A968C` · `faint` `#6B675F` · `border` `#33312A` · `borderStrong`
`#45423A` · `accent` `#C9A05C` · `accentText` `#E0B878` · `accentSoft` `#2E2920`.
Full set: `src/theme/tokens.ts`.

**Rules**

- Max ONE accent (Saffron). It marks _selection and state_, never decoration.
- No pure black `#000000`, no pure white chrome — ink is `#111111`, dark surfaces are warm-charcoal, never neutral gray.
- Zero hardcoded hex in screens/components. Two exceptions, both named constants with a content comment: the **canvas content palettes** (`src/theme/content-palette.ts` — `inkSwatches`, `paperSwatches`, `DEFAULT_INK`), which are written into project files.
- Translucent chrome is a token via `withAlpha(hex, a)` — a floating bar over the canvas is only legible as a frosted layer (§5).

## 3. Typography Rules

Arabic-first app: fonts resolve through `fontRoles[language]` — **never** a raw
fontFamily or the system default.

- **UI Arabic:** Cairo / Cairo-Bold · **UI Latin:** Geist / Geist-Bold · **Display & brand:** Amiri / Amiri-Bold (both languages).
- **Bundled faces (two scripts), split in two.** A **core** set — the eight faces the first screen draws (Cairo, Geist, Amiri) — loads before the first pixel; a **display** set — twenty-nine Arabic calligraphic faces plus ten Latin — loads lazily, and the brand loader covers the wait (`docs/editor-font-loading.md`). Nothing on the first screen draws a calligraphic face.
- **Script filter.** `font-families.ts` tags every family `arabic` or `latin`; the picker filters bundled rows with a three-way **All / Arabic / Latin** control (opening on the script already in use), and a Latin family is display-only — a Latin cluster is a connected run no more than a word is.
- **Remote faces.** Google Fonts are downloaded on demand and cached, and **pins** are the device-local shortcut back to a face (`docs/editor-remote-fonts.md`, `docs/editor-font-pins.md`). Pinned rows stay visible through the script filter because a pin is cross-script.
- **Design content** is rendered via the Skia Paragraph API with the family from `familyForKey` — inside designs only, never chrome.
- **Type scale:** display 40 → micro 11 (`typeScale`). Hierarchy = weight + size + leading as a set; never size alone.
- **Tracking is Latin-only:** letter-spacing breaks Arabic cursive joining. `AppText` enforces this — no raw `letterSpacing > 0` or `textTransform: uppercase` may ever reach an Arabic string. Negative tracking is equally banned on Arabic.
- Body leading relaxed (1.5); headings tight (1.15).

## 4. Component Stylings

All primitives in `src/components/ui/`. Brand identity lives here — `@expo/ui`
is FORBIDDEN for these (see §7).

- **Buttons** — Flat, tactile. Primary: Iron Ink fill, `onInk` label. Secondary: Whisper Alt fill, hairline border. Danger: Oxblood fill. Height 44/52, radius 8. Press = scale 0.97 starting on touch-DOWN, spring back. Label always in language-correct bold UI font. Loading replaces label with spinner.
- **Cards** — Default `elevated`: NO border, surface fill, tinted soft shadow (radius 10). `outline` variant keeps the hairline for structural grouping only. Radius 12. Never stack borders everywhere — tone separates, lines divide only when structure demands it.
- **IconButtons** — Square, radius 8, min 44pt target enforced by auto hit-slop. `label` prop required for icon-only use (accessibility).
- **AppText** — The ONLY way to render text. Resolves font roles + type scale; strips Latin-only effects for Arabic.
- **Sheets** — `@expo/ui/community/bottom-sheet` on every OS (SwiftUI sheet on iOS, Compose `ModalBottomSheet` on Android, Vaul drawer on the web), so the platform owns presentation, drag-to-dismiss, back-press/Escape dismissal, focus trapping, body-scroll lock and reduced motion. The app owns the content inside: the pill handle, title/close row and children stay the custom kit's (§7). Radius 12 top corners, dimmed scrim. On the web the drawer is capped at `min(720px, 92vw)` and centred (styled by `public/midad-web.css`) — a sheet is a surface of its own, so it is wider than the inline surfaces' `layout.maxContent` (480), which would read as cramped for a list of specimens. The sheet auto-sizes to its content on every platform, bounded at 82% of the window so a long list scrolls inside instead of growing the sheet off-screen. The community variant is used rather than the universal `BottomSheet` because only it hands the hosted React Native content the sheet's width on Android.
- **SegmentedControl** — Pill track (`surfaceAlt`), spring-slid thumb. Labels via AppText.
- **Inputs** — `surfaceAlt` fill, hairline border, radius 8. RTL-aligned for Arabic. Placeholder in `faint`.
- **Placed assets** — an image (`i_…`) and an imported icon (`ic_…`) are objects like a shape or a glyph: they carry a transform, z-order, opacity and group membership, and they render through the same three-site contract (canvas, PNG, SVG — `docs/editor-render-contract.md` §5.1). An image's frame follows the picture's own aspect rather than letterboxing it to a square; an icon is drawn from paths stored in the document, in the object's colour, so it takes the ink and its export scales without blur.
- **Insert sheet** — three tabs: **Glyphs**, **Shapes**, **Media**. Ornament and shape tiles are drawn through the same geometry tables the canvas and the exporters read, so a tile is always a faithful preview of the object it inserts. Media holds the photo picker and the icon search.
- **Icon picker row** — a fixed preview tile (geometry streams in, so the list never reflows under the finger), the icon name and its set. A row that cannot be inked — a palette set, an unsupported body, a set off the allowlist — is shown **disabled with the reason**, never hidden. Before a query the block shows **Recent** (icons this device inserted, geometry included, so each draws and re-inserts with no network) or, when there are none, **Suggested** (shipped defaults); each recent carries a forget × and the list a Clear action.
- **Empty states** — Composed moments: calligraphic glyph + title + guidance + single CTA. Never bare "no data".
- **Feedback** — Save/export show visible confirmation (indicator morph, not toast spam). Destructive actions get an undo snackbar (5 s) with a draining ring, NOT a confirm dialog.
- **Loaders** — ActivityIndicator in `ink`, used sparingly; prefer skeleton shapes matching final layout, and the brand loader for the two font waits.

## 5. Layout Principles

- **Mobile-first**: designed at ~390pt width; web adapts, never leads (`breakpoint.wide` 600 switches to tablet/desktop; `layout.maxContent` 480, `maxControl` 320, `maxToolbar` 560 centre the column rather than stretching it).
- Screen padding `spacing.xl` (24); section gaps `lg–xl`; list gaps `md`.
- Floating translucent docks/bars (semi-transparent surface + hairline) float OVER content; content scrolls beneath.
  - **Editor exception.** The editor does NOT float its chrome. Its contextual bar is a reserved, fixed-height rail sitting in the column flow above the tool rail (`contextRail` in `editor/EditorScreen.tsx`). Two structural reasons: chrome floating over the canvas would sit between the finger and the selection border + handles the canvas itself draws, and a bar that mounted and unmounted in the flow would resize the canvas and re-run fit-to-view, visibly zooming the design mid-edit. Reserving the slot solves both. Two things _do_ sit inside the canvas box — the learn-mode cards and the collection bar (`editor/collection-bar.tsx`) — and both pass the same test: each is anchored to the selection or to the mode rather than to a tool, neither enters the column flow (so neither can resize the canvas), and while each is up the gestures it could obstruct are off or beside the point. The collection bar is the member track that used to sit in this rail's context zone; it left because navigation and actions were sharing one width budget and the actions lost (`editor-collections.md` §5).
    The rail is one row and never scrolls as a whole. The selection's actions are ranked in `editor/selection-actions.tsx`, only as many render as fit, and the rest sit in a labelled sheet behind a permanent `⋯` (`More`) — a tail that scrolls out of sight is invisible chrome (in Arabic it parks off the _left_ edge), whereas `⋯` is an affordance. That sheet is also where the bar is _arranged_: every row carries a pin, and a pinned action moves to the head of the row — the one position the width budget can never cut — while an unpinned one waits in the sheet until it is wanted again. The row's tap runs the action; the pin decides whether the bar keeps it. Only the contextual zone (colour swatches, the background picker, a refusal notice) keeps a scroller: its contents are content about the current tool, not actions, and a swatch set can legitimately outgrow the width. The style panel is a _bar action_ rather than a navigator, because a navigator big enough to show the preset's name and step through it would have spent the width the actions need. `⋯` is also the one control learn mode leaves live — it _reveals_ controls rather than acting on the design, so while learning it opens that same list as a scrollable reference (one row per action: label, role, chord) instead of explaining itself, which would leave everything behind it unexplained.
- Touch targets ≥ 44×44 everywhere — non-negotiable.
- One primary action per screen. Header holds title + count; creation gets a FAB (56pt circle, ink fill), never a header button crowd.
- Safe areas respected on all edges; lists pad bottom beyond tab bar.

## 6. Motion & Interaction

Engine: reanimated springs only. Presets in `springs` tokens:

| Token      | Physics               | Use                                                                    |
| ---------- | --------------------- | ---------------------------------------------------------------------- |
| `ui`       | ζ 1.0, stiffness 260  | presses, toggles, thumbs                                               |
| `momentum` | ζ 0.8, stiffness 320  | flicks, throws                                                         |
| `elastic`  | ζ 0.6, stiffness 300  | a latch that should give (never a return)                              |
| `sheet`    | ζ 0.85, stiffness 300 | snackbar enter/exit (sheets are native now — their motion is the OS's) |
| `exit`     | ζ 1.0, stiffness 380  | dismissals and other system responses                                  |

- ζ is the **damping ratio**: `1` is critically damped (fastest approach, no
  overshoot), below `1` overshoots. Author presets as ζ + stiffness, never as a
  bare `damping`. Reanimated's `withSpring` `damping` is an _absolute
  coefficient_ (`damping = 2 · ζ · √(stiffness · mass)`), so passing a ratio
  there yields a ~30× underdamped spring that visibly rings for seconds.
  `tokens.ts` does this conversion in `dampingFor`, and
  `springDampingRatios` exposes the raw ζ for APIs that want a ratio
  (`LayoutAnimation.springDamping`).

- Respond on pointer-down; feedback continuous during gestures; commit on release.
- Animate `transform` + `opacity` exclusively.
- Velocity handoff: gesture release velocity feeds the settling spring; momentum projection picks snap targets. Interruptible always — input is never locked mid-transition.
- Haptics on meaningful moments only (expo-haptics): tool tick, save success, delete warning. Web = silent no-op.
- Reduced motion: cross-fades replace transforms; haptics remain.

## 7. Library Policy

- **Custom design system owns ALL brand surfaces** (buttons, cards, text, sheets, controls).
- **`@expo/ui` allowed ONLY** for platform-behavior utilities, imported directly because their universal implementations already cover web — no per-util `.web.tsx` fallback is needed: `Host` + `Switch` (`components/ui/toggle.tsx`), `Host` + `Slider` (`components/ui/slider.tsx`). It is also the `Sheet` primitive's engine, imported as `@expo/ui/community/bottom-sheet` (`components/ui/sheet.tsx`): the **community** variant, not the universal `BottomSheet`, because only it hands the hosted React Native content the sheet's width on Android. The brand chrome (handle, title, close, padding, width cap) stays in the primitive.
- New runtime dependencies require a spec amendment (`.artifacts/00-design-direction.md`) — e.g. `fflate` for the `.midad` container and `expo-image-picker` for placed photos.

## 8. Anti-Patterns (Banned)

- ❌ Emojis anywhere in UI
- ❌ Hardcoded hex colors outside documented content-palette constants
- ❌ `letterSpacing` or `uppercase` on any Arabic string (breaks joining)
- ❌ System-default fontFamily — every Text goes through font roles
- ❌ Border-on-everything monotony; borders without structural purpose
- ❌ Pure black/neutral-gray chrome; neon glows; gradient decoration
- ❌ Icon-only buttons without accessibility labels
- ❌ Touch targets under 44pt
- ❌ Confirm dialogs for destructive actions (undo snackbar instead)
- ❌ Linear easing or duration-based tweens on interactive elements — springs only
- ❌ Input lockout during transitions
- ❌ Dead-end tool states (a selected tool must always render something or explain why not)
- ❌ Approximating an input that cannot be represented honestly — an icon that cannot be stored as paths or inked is disabled with a reason, never drawn approximately
- ❌ Two near-identical competing metaphors (e.g., save-as-download next to export)
- ❌ AI copy clichés ("seamless", "elevate", "unleash") in any locale

## Version history

- **v2 · 2026-10-05** — Reconciled §2 with `tokens.ts` (`muted` `#787774`, and
  the `onInk` / `borderStrong` / status / `shadow*` roles the table was missing).
  Expanded §3 with the two-script font story (core/display split, the loader, the
  script filter, remote faces and pins). Added the 0.5/0.6 surfaces to §4
  (placed assets, the Insert sheet's three tabs, the icon picker row and its
  Recent/Suggested empty state, the collection bar, the undo snackbar). Named the
  layout caps in §5. Fixed §7's Sheet-engine contradiction (community
  `bottom-sheet`, not the universal `BottomSheet`) and dropped the stale
  per-util `.web.tsx` fallback claim. Added the refuse-rather-than-approximate
  rule to §8.
- **v1** — Initial design system.
