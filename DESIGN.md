---
version: alpha
name: midad-design-system
description: 'مِداد (midad) is an Arabic-first calligraphy editor whose interface behaves like a quiet desk: warm bone paper, iron-gall ink, and a single saffron accent that marks selection and state, never decoration. Every surface separates by tone and hairlines rather than stacked borders, type hierarchy is weight plus size plus leading as a set, and interactive elements settle by spring instead of duration because a tween cannot absorb an interruption mid-flight.'

colors:
  primary: '#111111'
  primary-dark: '#F2EFE7'
  primary-foreground: '#FFFFFF'
  primary-foreground-dark: '#16150F'
  paper: '#F7F6F3'
  paper-dark: '#16150F'
  paper-bright: '#FBFBFA'
  paper-bright-dark: '#1D1B14'
  surface: '#FFFFFF'
  surface-dark: '#211F18'
  surface-alt: '#F9F9F8'
  surface-alt-dark: '#26241C'
  surface-pressed: '#EFEEE9'
  surface-pressed-dark: '#2E2B22'
  ink: '#111111'
  ink-dark: '#F2EFE7'
  ink-soft: '#2F3437'
  ink-soft-dark: '#D8D4C9'
  muted: '#787774'
  muted-dark: '#9A968C'
  faint: '#A9A69F'
  faint-dark: '#6B675F'
  on-ink: '#FFFFFF'
  on-ink-dark: '#16150F'
  border: '#EAEAEA'
  border-dark: '#33312A'
  border-strong: '#D8D5CE'
  border-strong-dark: '#45423A'
  accent: '#B0894F'
  accent-dark: '#C9A05C'
  accent-text: '#956400'
  accent-text-dark: '#E0B878'
  accent-soft: '#F5EEE2'
  accent-soft-dark: '#2E2920'
  danger: '#9F2F2D'
  danger-dark: '#E8A6A3'
  danger-bg: '#FDEBEC'
  danger-bg-dark: '#2E1F1E'
  success: '#346538'
  success-dark: '#9CC694'
  success-bg: '#EDF3EC'
  success-bg-dark: '#1C2A1B'

typography:
  display:
    fontFamily: 'Amiri, Amiri-Bold, serif'
    fontSize: '40px'
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: 0
  title:
    fontFamily: 'Amiri, Amiri-Bold, serif'
    fontSize: '32px'
    fontWeight: 400
    lineHeight: 1.13
    letterSpacing: 0
  heading:
    fontFamily: 'Cairo, Cairo-Bold, Geist, Geist-Bold, sans-serif'
    fontSize: '24px'
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: 0
  body:
    fontFamily: 'Cairo, Geist, sans-serif'
    fontSize: '16px'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  small:
    fontFamily: 'Cairo, Geist, sans-serif'
    fontSize: '14px'
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: 0
  caption:
    fontFamily: 'Cairo, Geist, sans-serif'
    fontSize: '12px'
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: 0

spacing:
  xxs: '2px'
  xs: '4px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '24px'
  xxl: '32px'
  xxxl: '48px'
  huge: '64px'

rounded:
  sm: '4px'
  md: '6px'
  lg: '8px'
  xl: '12px'
  pill: '9999px'
---

## Overview

midad is an Arabic-first calligraphy editor: a canvas where the writer places glyphs, ornaments, icons and images, then exports the composition. The interface is the quiet room around the artwork and never competes with the canvas.

The atmosphere is a calligrapher's desk at dawn: warm bone paper, iron-gall ink, and one saffron accent that marks selection, active tools, focus and undo links. Density sits at 4/10, balanced and generous around every group. Variance sits at 3/10, predictable and calm, with asymmetry reserved for the artwork itself. Motion sits at 6/10, fluid springs with instant response on touch-down. The emotional target is calm confidence: the writer should feel like a craftsman holding excellent tools, never like a software user. Arabic is the primary reading direction, RTL is the primary layout, and English is a first-class guest rather than an afterthought.

Tokens live in `src/theme/tokens.ts` (palettes, spacing, radii, elevation, motion, type scale) and in `src/theme/font-families.ts` (the face registry). Where this file and those files disagree, the code is corrected to match this file.

## Colors

Two palettes, one system. The light palette is warm paper; the dark palette inverts paper and ink into warm charcoal, never neutral grey. Both are defined in `src/theme/tokens.ts` as `palettes.light` and `palettes.dark`, and no screen or component may hardcode a hex outside the named content-palette constants. The frontmatter uses kebab-case keys; the code uses the camelCase equivalents (`paperBright`, `surfaceAlt`, `onInk`).

| Token           | Light   | Dark    | Role                                             |
| --------------- | ------- | ------- | ------------------------------------------------ |
| paper           | #F7F6F3 | #16150F | App background                                   |
| surface         | #FFFFFF | #211F18 | Cards, sheets, docks                             |
| surface-alt     | #F9F9F8 | #26241C | Subtle fills, secondary buttons                  |
| surface-pressed | #EFEEE9 | #2E2B22 | Pressed states                                   |
| ink             | #111111 | #F2EFE7 | Primary text, solid CTAs                         |
| ink-soft        | #2F3437 | #D8D4C9 | Strong secondary text                            |
| muted           | #787774 | #9A968C | Secondary text, AA on paper                      |
| faint           | #A9A69F | #6B675F | Disabled, tertiary, placeholders                 |
| border          | #EAEAEA | #33312A | Structural hairlines only                        |
| border-strong   | #D8D5CE | #45423A | Dividers that must read                          |
| accent          | #B0894F | #C9A05C | Selection rings, active tools, focus, undo links |
| accent-text     | #956400 | #E0B878 | Accent text on a light or dark ground            |
| accent-soft     | #F5EEE2 | #2E2920 | Accent tint backgrounds                          |
| danger          | #9F2F2D | #E8A6A3 | Destructive, on danger-bg                        |
| success         | #346538 | #9CC694 | Confirmation, on success-bg                      |

The palette carries working names as well as tokens, and those names are how the colours are discussed: Bone Paper `#F7F6F3` (`paper`), Paper Bright `#FBFBFA` (`paperBright`), Pure Surface `#FFFFFF` (`surface`), Whisper Alt `#F9F9F8` (`surfaceAlt`), Pressed Cloth `#EFEEE9` (`surfacePressed`), Iron Ink `#111111` (`ink`), Soft Iron `#2F3437` (`inkSoft`), Graphite `#787774` (`muted`), Faded Ash `#A9A69F` (`faint`), On Ink `#FFFFFF` (`onInk`), Hairline `#EAEAEA` (`border`), Strong Hairline `#D8D5CE` (`borderStrong`), Saffron Accent `#B0894F` (`accent`), Saffron Text `#956400` (`accentText`), Saffron Wash `#F5EEE2` (`accentSoft`), Oxblood `#9F2F2D` (`danger`), and Success `#346538`.

Status pairs always ship as a tint plus a text ink that clears AA on it: `danger-bg` `#FDEBEC` with `danger` `#9F2F2D`, `success-bg` `#EDF3EC` with `success` `#346538`, and the four tag pairs `paleRed` `#FDEBEC`/`#9F2F2D`, `paleBlue` `#E1F3FE`/`#1F6C9F`, `paleGreen` `#EDF3EC`/`#346538`, `paleYellow` `#FBF3DB`/`#956400`. In the dark palette those become `paleRed` `#2E1F1E`/`#E8A6A3`, `paleBlue` `#142A38`/`#8FC4E8`, `paleGreen` `#1C2A1B`/`#9CC694` and `paleYellow` `#2E2818`/`#D9BE7E`. A tint without its matching text ink is not a status pair.

Translucent chrome is a token, produced by `withAlpha(hex, alpha)` rather than a hand-mixed colour, because a floating bar over the canvas is only legible as a frosted layer. The same helper produces the shadow ink: 6% of `#111111` in the light palette and 40% of `#000000` in the dark one.

Rules for the palette:

- One accent only. Saffron marks selection and state, never decoration.
- No pure black `#000000` in the interface, and no pure white chrome. Ink is `#111111`; dark surfaces are warm charcoal, never neutral grey.
- Zero hardcoded hex in screens and components. The only exceptions are the named content constants in `src/theme/content-palette.ts` (`inkSwatches`, `paperSwatches`, `DEFAULT_INK`, plus the engrave and shadow inks), which are written into project files and therefore sit outside the UI palette.

## Typography

Arabic-first, so fonts resolve through `fontRoles[language]` and never through a raw family or the system default. UI Arabic is Cairo (weights via Cairo-Bold), UI Latin is Geist (Geist-Bold, Geist-Medium, Geist-SemiBold), and display and brand text is Amiri in both languages.

- **Two sets, split by need.** A core set of eight faces (Cairo, Geist, Amiri) loads before the first pixel. A display set of twenty-nine Arabic calligraphic faces plus ten Latin faces loads lazily behind the brand loader, so nothing on the first screen waits for a calligraphic face. The loading story is `docs/editor-font-loading.md`.
- **Script filter.** `font-families.ts` tags every family `arabic` or `latin`, and the picker filters bundled rows with a three-way All, Arabic, Latin control that opens on the script already in use. A Latin family is display-only, because a Latin cluster is a connected run no more than a word is.
- **Remote faces.** Google Fonts are downloaded on demand and cached, and pins are the device-local shortcut back to a face (`docs/editor-remote-fonts.md`, `docs/editor-font-pins.md`). A pinned row stays visible through the script filter, because a pin is cross-script.
- **Design content** renders through the Skia Paragraph API with the family from `familyForKey`, inside designs only and never in chrome.
- **Scale.** The type scale runs display 40 to micro 11 in `typeScale`. Hierarchy is weight plus size plus leading as a set, never size alone.
- **Tracking is Latin-only.** Letter-spacing, negative or positive, and `textTransform: uppercase` break Arabic cursive joining, and `AppText` strips both for Arabic strings. No raw tracking may ever reach an Arabic string.
- **Leading.** Body leading is relaxed at 1.5; headings tighten to about 1.1, with the title step at 1.13 and the heading step at 1.25.

## Layout

Mobile-first, designed at roughly 390pt width. `breakpoint.wide` (600) switches to tablet and desktop, where the column keeps a phone-proportioned measure and centres rather than stretching: `layout.maxContent` 480, `layout.maxControl` 320, `layout.maxToolbar` 560.

- Spacing scale in dp: 2, 4, 8, 12, 16, 24, 32, 48, 64 (`spacing.xxs` to `spacing.huge`). Screen padding is 24, section gaps are 16 to 24, list gaps are 12.
- Radii: 4 (`sm`), 6 (`md`), 8 (`lg`), 12 (`xl`), and a 9999 pill. Cards and sheets take 12; controls and inputs take 8.
- Elevation is a four-step ramp in `shadows`: `card` and `panel` at offset 2 and blur 8, `float` and `sheet` at offset 4 and blur 16. Only those four surfaces lift off the page; everything else separates by tone and hairline. Platform styles come from `elevationStyle`, which emits `boxShadow` on web and `shadow*` plus `elevation` on native.
- Floating docks and bars float over content and content scrolls beneath. The editor is the documented exception: its contextual action rail is a reserved fixed-height row of 56dp in the column flow, between the canvas and the tool rail (`contextRail` in `editor/EditorScreen.tsx`, height `CONTEXT_RAIL_HEIGHT`). Chrome floating over the canvas would sit between the finger and the selection handles the canvas itself draws, and a rail that mounted and unmounted would resize the canvas and re-run fit-to-view mid-edit. Reserving the slot solves both.
- Only two things sit inside the canvas box: the learn-mode cards and the collection bar (`editor/collection-bar.tsx`). Both pass the same test. Each is anchored to the selection or to the mode rather than to a tool, neither enters the column flow so neither can resize the canvas, and while each is up the gestures it could obstruct are off or beside the point. The collection bar is the member track that used to sit in the rail's context zone; it left because navigation and actions were sharing one width budget and the actions lost (`editor-collections.md` section 5).
- The rail is one row and never scrolls as a whole. The selection's actions are ranked in `editor/selection-actions.tsx`, only as many render as fit, and the remainder sit in a labelled sheet behind a permanent `⋯` (`More`). A tail that scrolls out of sight is invisible chrome, and in Arabic it parks off the left edge, whereas `⋯` is an affordance.
- That sheet is also where the bar is arranged. Every row carries a pin, a pinned action moves to the head of the row, which is the one position the width budget can never cut, and an unpinned one waits in the sheet until it is wanted again. The row's tap runs the action; the pin decides whether the bar keeps it.
- Only the contextual zone keeps a scroller: colour swatches, the background picker and a refusal notice. Its contents are content about the current tool rather than actions, and a swatch set can legitimately outgrow the width. The style panel is a bar action rather than a navigator, because a navigator big enough to show a preset's name and step through it would have spent the width the actions need.
- `⋯` is the one control learn mode leaves live. It reveals controls rather than acting on the design, so while learning it opens that same list as a scrollable reference, one row per action with label, role and chord.
- Touch targets are at least 44 by 44 everywhere. One primary action per screen: the header carries the title and a count, and creation is a 56pt ink FAB rather than a header button crowd.
- Safe areas are respected on all edges and lists pad beyond the tab bar, so the last row is never trapped under it.

## Component Stylings

All brand primitives live in `src/components/ui/`. The custom kit owns every brand surface, and `@expo/ui` is allowed only as a platform-behaviour engine.

### Buttons

Flat and tactile. Primary is an Iron Ink fill with an `on-ink` label, secondary is a `surface-alt` fill with a hairline border, and danger is the oxblood `danger` fill. Heights are 44 and 52 with radius 8. Press feedback is scale 0.97 starting on touch-down, settling back by spring. Labels always render in the language-correct bold UI font, and a loading state replaces the label with a spinner rather than widening the button.

### Header

Screens draw their own header, because the native one is disabled (`headerShown: false`). A screen header carries the title and a count, and creation is the 56pt ink FAB rather than a header action, which keeps one primary action per screen. A collapsible header is allowed where content is long: the gallery's `GalleryHeader` is driven by a scroll offset shared with the list, so the header shrinks as the canvas scrolls instead of pinning a second toolbar. The editor deliberately has no floating header at all; its contextual rail sits in the column flow (see Layout).

### Cards & Containers

The default card is `elevated`: no border, `surface` fill, and the tinted soft shadow at radius 10 blur. An `outline` variant keeps the hairline for structural grouping only. Corner radius is 12. Never stack borders everywhere: tone separates surfaces, and a line is drawn only when structure demands it.

### Navigation & Menu

Navigation is shallow by design, which is why the editor rail carries actions rather than a navigator. The one menu in the app appears inside the editor: selection actions are ranked, only as many render as fit, and the remainder sit in a labelled `⋯` sheet, where each row also carries a pin that promotes it to the head of the row. `⋯` is the only control learn mode leaves live, because it reveals controls instead of acting on the design. Sheets themselves are platform-owned, so drag-to-dismiss, back-press, Escape, focus trapping and body-scroll lock come from the OS.

### Footer

There is no footer region. The bottom of the screen belongs to the tab bar and to sheets: a sheet anchors to the bottom edge and therefore casts upward, which is why `shadows.sheet` alone carries a negative `offsetY` of -4 while `card`, `panel` and `float` cast down. Lists pad beyond the tab bar so the last row is never trapped under it, and a snackbar floats above content rather than sitting in a footer slot.

### Input Fields

`surface-alt` fill, hairline border, radius 8, 44pt minimum height. Fields align right-to-left for Arabic and flip through the same font-role resolution as text. Placeholders use `faint`, which is the disabled and tertiary tone, so a placeholder can never be mistaken for a value.

### Icon Buttons, Text and Feedback

Icon-only controls are square, radius 8, with the 44pt target enforced by auto hit-slop, and they require a `label` prop: the compiler-facing API refuses to render one without it. `AppText` is the only way to render text, resolving font roles and the type scale and stripping Latin-only effects for Arabic. Save and export confirm with an indicator that morphs in place, not with toast spam. Destructive actions get an undo snackbar with a five-second window and a draining ring (`UNDO_WINDOW_MS` in `components/gallery/use-deferred-delete.ts`), never a confirm dialog. Loaders are an `ActivityIndicator` in `ink` used sparingly, skeleton shapes that match the final layout, and the brand loader for the two font waits.

### Distinctive Components

- **Canvas card.** The editor's canvas is a bordered box (`layout.canvasBorder` 1) that the app measures and draws into. On-canvas chrome positions against that drawing box, which is why the border width is a shared token rather than a per-file constant.
- **Segmented control.** Pill track in `surface-alt` with a spring-slid thumb, labels resolved through `AppText`.
- **Sheets.** A platform-owned sheet on every OS (SwiftUI sheet on iOS, Compose `ModalBottomSheet` on Android, a drawer on web) so the platform owns dismissal, focus trapping, body-scroll lock and reduced motion. The app owns the content: pill handle, title and close row, radius 12 top corners, dimmed scrim. The sheet caps at `min(720px, 92vw)` on web, styled by `public/midad-web.css` and centred, and at 82% of the window everywhere, so a long list scrolls inside instead of pushing the sheet off screen. On web the drawer is deliberately wider than the inline column's `layout.maxContent` (480), which would read as cramped for a list of specimens. The engine is the community variant `@expo/ui/community/bottom-sheet`, not the universal `BottomSheet`, because only the community variant hands the hosted React Native content the sheet's width on Android; the brand chrome stays in the primitive.
- **Placed assets.** An image (`i_…`) and an imported icon (`ic_…`) are objects like a shape or a glyph: each carries a transform, z-order, opacity and group membership, and renders through the same three-site contract (canvas, PNG, SVG, `docs/editor-render-contract.md` section 5.1). An image's frame follows the picture's own aspect rather than being letterboxed to a square, and an icon draws from paths stored in the document, in the object's colour, so it takes the ink and exports without blur.
- **Insert sheet.** Three tabs: Glyphs, Shapes and Media. Ornament and shape tiles are drawn through the same geometry tables the canvas and the exporters read, so a tile is always a faithful preview of the object it inserts. Media holds the photo picker and the icon search.
- **Icon picker row.** A fixed preview tile, so geometry streaming in never reflows the list under the finger, then the icon name and its set. A row that cannot be inked, whether a palette set, an unsupported body or a set off the allowlist, is shown disabled with the reason and never hidden. Before a query the block shows Recent, which carries the geometry of what this device inserted so each row draws and re-inserts with no network, or Suggested when there are none; every recent carries a forget control and the list a Clear action.
- **Empty states.** A composed moment, never a bare no-data line: calligraphic glyph, title, guidance, one CTA.

## Motion & Interaction

Engine is reanimated springs only. Presets live in `springs` in `src/theme/tokens.ts`, expressed as a damping ratio converted to the coefficient `withSpring` expects, because handing Reanimated a ratio produces a spring roughly thirty times underdamped that rings for seconds.

| Token    | Ratio and stiffness       | Use                                                                     |
| -------- | ------------------------- | ----------------------------------------------------------------------- |
| ui       | ratio 1.0, stiffness 260  | presses, toggles, thumbs                                                |
| momentum | ratio 0.8, stiffness 320  | flicks, throws                                                          |
| elastic  | ratio 0.6, stiffness 300  | a latch that should give, never a return                                |
| sheet    | ratio 0.85, stiffness 300 | snackbar enter and exit; sheets are native, so their motion is the OS's |
| exit     | ratio 1.0, stiffness 380  | dismissals and other system responses                                   |

A ratio of 1 is critically damped, the fastest approach that never overshoots; below 1 overshoots. Presets are authored as ratio plus stiffness, never as a bare `damping`, because `withSpring` takes an absolute coefficient (`damping = 2 * ratio * sqrt(stiffness * mass)`). `tokens.ts` performs the conversion in `dampingFor`, and `springDampingRatios` exposes the raw ratios for APIs that take one, notably React Native's `LayoutAnimation.springDamping`.

Interaction rules:

- Respond on pointer-down, keep feedback continuous during the gesture, and commit on release.
- Animate `transform` and `opacity` exclusively.
- Hand gesture-release velocity to the settling spring, and let momentum projection pick snap targets. Every transition is interruptible; input is never locked.
- Haptics fire on meaningful moments only, through expo-haptics: the tool tick, save success and a delete warning. On web they are a silent no-op.

### Durations & Easings

Durations exist for non-interactive reveals only: `fast` 150ms, `base` 250ms and `slow` 400ms, with `ease` as easeOutQuint (0.16, 1, 0.3, 1) and a stagger step of 80ms. Interactive elements never use these; they use springs.

### Motion Roles

- **Press and toggle:** the `ui` preset, critically damped (ratio 1.0), so there is no visible bounce.
- **Sheets and large surfaces:** `sheet` at ratio 0.85 on entry, paired with `exit` at ratio 1.0 and higher stiffness so a dismissal snaps out instead of settling.
- **Flicks and throws:** `momentum` at ratio 0.8, which keeps some momentum after release.
- **Latch:** `elastic` at ratio 0.6, for the one gesture that should visibly overshoot and settle back, the gallery row's swipe. Latch only: a return to rest must not overshoot past the origin.

### Reduced Motion

The platform owns reduced motion for sheets and drawers, so dismissal and presentation respect the OS setting without app code. For in-app motion, reduce to colour and opacity changes and drop transforms: cross-fades replace travel, no scale and no spring movement. Haptics remain.

### Banned Motion

- Linear easing or duration-based tweens on interactive elements. Springs only.
- Input lockout during a transition; a control stays live while it animates.
- Overshoot on a return to rest, which would reveal the opposite action.
- Motion that hides state rather than showing it: no spinner in place of a determinate progress, no toast where an inline indicator belongs.

## Accessibility

Touch targets are at least 44 by 44 with auto hit-slop on icon buttons. Icon-only controls require a `label` prop, and the compiler-facing API refuses to render them without one. Secondary text tones are chosen to clear AA on their own background, and the pale status pairs carry a matching text ink. Arabic strings never receive letter-spacing or uppercase transforms, which is an accessibility requirement as much as a typographic one, since both destroy the joins that make the word readable. System font scaling is respected, and the layout caps keep the column readable at large sizes instead of stretching it. Interactive cards pass their accessibility state and custom actions to the node that takes focus, so a gesture-only affordance stays reachable without touch.

## Responsive

The phone layout is the design, and larger screens adapt rather than lead. `breakpoint.wide` at 600 switches to the tablet and desktop composition, where `layout.maxContent` 480, `layout.maxControl` 320 and `layout.maxToolbar` 560 centre the column instead of stretching it to the window. Sheets cap at `min(720px, 92vw)` on web and at 82% of the window height on every platform, so the content scrolls inside the sheet. The platform sheet mapping (SwiftUI, Compose `ModalBottomSheet`, web drawer) keeps dismissal and reduced motion native on each target. Safe areas are respected on all edges, and lists pad beyond the tab bar so the last row remains reachable. A genuinely desktop-first composition has not been designed; above the breakpoint the app is a centred phone measure with more room around it.

## Do's and Don'ts

Do:

- Resolve every font through font roles, and render text only through `AppText`.
- Use the accent (`accent`) for selection and state only.
- Separate surfaces by tone and hairlines; lift only `card`, `panel`, `float` and `sheet`.
- Keep one primary action per screen and put creation in the FAB.
- Enforce 44pt minimum targets and label every icon-only control.
- Offer undo for destructive actions, and make the refusal explicit when something cannot be represented.
- Use springs for interaction and the named durations only for reveals.

Don't:

- Do not hardcode a hex outside the documented content-palette constants.
- Do not put letter-spacing or uppercase on an Arabic string, in either direction.
- Do not use pure black, neutral-grey chrome, neon glows or gradient decoration.
- Do not add a border to everything, or a border without structural purpose.
- Do not use the system default family for text.
- Do not confirm destructive actions with a dialog when an undo snackbar works.
- Do not lock input during a transition, leave a tool in a dead-end state, or approximate an input that cannot be stored honestly. An icon that cannot be stored as paths or inked is disabled with a reason, never drawn approximately.
- Do not ship emoji anywhere in the interface, and do not put AI copy clichés such as "seamless", "elevate" or "unleash" in any locale.
- Do not run two near-identical competing metaphors side by side, such as save-as-download next to export.
- Do not use linear easing or duration-based tweens on interactive elements.

Library policy. The custom design system owns every brand surface: buttons, cards, text, sheets and controls. `@expo/ui` is allowed only for platform-behaviour utilities, imported directly because their universal implementations already cover web, so no per-utility `.web.tsx` fallback is needed: `Host` with `Switch` in `components/ui/toggle.tsx` and `Host` with `Slider` in `components/ui/slider.tsx`. It is also the Sheet primitive's engine, imported as `@expo/ui/community/bottom-sheet` in `components/ui/sheet.tsx`, with the brand chrome kept in the primitive. A new runtime dependency requires a spec amendment in `.artifacts/00-design-direction.md`, as `fflate` did for the `.midad` container and `expo-image-picker` did for placed photos.

## Known Gaps

- Motion tokens are numbers in `tokens.ts`, not a documented ramp: any screen that needs a duration outside `fast`, `base` and `slow` currently hardcodes it.
- The gradient and ornament palettes in `content-palette.ts` are content colours written into project files, so they deliberately sit outside the UI palette.
- The web build adapts rather than leads. Layout behaviour above `breakpoint.wide` is derived from the caps, and a genuinely desktop-first composition has not been designed.
- The twenty-nine calligraphic faces load lazily, so a first render into a not-yet-loaded face shows a fallback until the brand loader resolves.
- Two documented dimensions have not reached the shipped build: the gallery header's round create action renders at 44pt rather than the 56pt creation control specified here, and the `Card` primitive resolves to `radius.lg` (8) rather than the radius 12 specified for cards.
- Version 2 (2026-10-05) reconciled the palette with `tokens.ts`, adding `muted` `#787774` and the `onInk`, `borderStrong`, status and shadow roles the earlier table was missing; expanded the typography story with the core and display font split, the brand loader, the script filter, remote faces and pins; added the placed assets, the Insert sheet's three tabs, the icon picker row with its Recent and Suggested states, the collection bar and the undo snackbar; named the layout caps; corrected the sheet engine to the community `bottom-sheet` and dropped a stale per-utility `.web.tsx` fallback claim; and added the rule to refuse rather than approximate. Version 1 was the initial system.

## Agent Prompt Guide

Apply this file as the single source of truth for any screen or component you generate for midad. Start from the tokens, not from a screenshot: pick colours by role from Colors, resolve type through the scale and font roles, and take spacing and radii from Layout. Compose brand surfaces only from the primitives in Component Stylings and never mix in a third-party component library for a brand surface; `@expo/ui` is a behaviour engine, not a visual one. Movement comes from the Motion section's presets: springs for interaction, durations for reveals, and honour reduced motion. Keep the Arabic-first posture: no tracking or uppercase on Arabic, RTL alignment by default, and one accent used for state. Before you finish, check the output against Do's and Don'ts, and if a rule cannot be satisfied with the given tokens, say so rather than inventing a value. A new runtime dependency needs a spec amendment in `.artifacts/00-design-direction.md` before it is used.
