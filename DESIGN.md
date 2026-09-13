# Design System: midad — مِداد

> **Single source of truth** for the midad visual language. Every screen,
> component, and generated artifact must comply. Plans live in `.artifacts/`;
> tokens live in `src/theme/tokens.ts`. When this document and code disagree,
> fix the code.

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
| Graphite           | `#6E6D68` | Secondary text — AA on paper (`muted`)                                   |
| Faded Ash          | `#A9A69F` | Disabled, tertiary (`faint`)                                             |
| Hairline           | `#EAEAEA` | Structural borders only (`border`)                                       |
| **Saffron Accent** | `#B0894F` | THE accent — selection rings, active tools, focus, undo links (`accent`) |
| Saffron Text       | `#956400` | Accent text on light bg (`accentText`)                                   |
| Saffron Wash       | `#F5EEE2` | Accent tint backgrounds (`accentSoft`)                                   |
| Oxblood            | `#9F2F2D` | Destructive only (`danger`)                                              |

### Dark — "Warm Ink" (inverts paper↔ink)

Background `#16150F` · Surface `#211F18` · Ink `#F2EFE7` · Accent lifts to
`#C9A05C`. Full token set: `src/theme/tokens.ts`.

**Rules**

- Max ONE accent (Saffron). It marks _selection and state_, never decoration.
- No pure black `#000000`, no pure white chrome — ink is `#111111`, dark surfaces are warm-charcoal, never neutral gray.
- Zero hardcoded hex in screens/components. Canvas **content** palettes (swatches written into project files) are the sole exception, grouped in named constants with a content comment.

## 3. Typography Rules

Arabic-first app: fonts resolve through `fontRoles[language]` — **never** a raw
fontFamily or the system default.

- **UI Arabic:** Cairo / Cairo-Bold
- **UI Latin:** Geist / Geist-Bold
- **Calligraphy (content):** Amiri, Aref Ruqaa, Noto Naskh, Noto Kufi, Reem Kufi, Lemonada — rendered via Skia Paragraph API inside designs only
- **Type scale:** display 40 → micro 11 (`typeScale`). Hierarchy = weight + size + leading as a set; never size alone.
- **Tracking is Latin-only:** letter-spacing breaks Arabic cursive joining. `AppText` enforces this — no raw `letterSpacing > 0` or `textTransform: uppercase` may ever reach an Arabic string. Negative tracking is equally banned on Arabic.
- Body leading relaxed (1.5); headings tight (1.15).

## 4. Component Stylings

All primitives in `src/components/ui/`. Brand identity lives here — `@expo/ui`
is FORBIDDEN for these (see §7).

- **Buttons** — Flat, tactile. Primary: Iron Ink fill, onInk label. Secondary: Whisper Alt fill, hairline border. Danger: Oxblood fill. Height 44/52, radius 8. Press = scale 0.97 starting on touch-DOWN, spring back. Label always in language-correct bold UI font. Loading replaces label with spinner.
- **Cards** — Default `elevated`: NO border, surface fill, tinted soft shadow (radius 10). `outline` variant keeps the hairline for structural grouping only. Radius 12. Never stack borders everywhere — tone separates, lines divide only when structure demands it.
- **IconButtons** — Square, radius 8, min 44pt target enforced by auto hit-slop. `label` prop required for icon-only use (accessibility).
- **AppText** — The ONLY way to render text. Resolves font roles + type scale; strips Latin-only effects for Arabic.
- **Sheets** — Bottom presentation, radius 12 top corners, dimmed scrim. Enter/exit via spring slide with drag-to-dismiss and velocity handoff; interruptible at all times.
- **SegmentedControl** — Pill track (surfaceAlt), spring-slid thumb. Labels via AppText.
- **Inputs** — surfaceAlt fill, hairline border, radius 8. RTL-aligned for Arabic. Placeholder in `faint`.
- **Empty States** — Composed moments: calligraphic glyph + title + guidance + single CTA. Never bare "no data".
- **Feedback** — Save/export show visible confirmation (indicator morph, not toast spam). Destructive actions get an undo snackbar (5s), NOT a confirm dialog.
- **Loaders** — ActivityIndicator in `ink`, used sparingly; prefer skeleton shapes matching final layout.

## 5. Layout Principles

- **Mobile-first**: designed at ~390pt width; web adapts, never leads.
- Screen padding `spacing.xl` (24); section gaps `lg–xl`; list gaps `md`.
- Floating translucent docks/bars (semi-transparent surface + hairline) float OVER content; content scrolls beneath.
  - **Editor exception.** The editor does NOT float its chrome. Its contextual bar is a reserved, fixed-height rail sitting in the column flow above the tool rail (`contextRail` in `editor/EditorScreen.tsx`), and it scrolls horizontally instead of wrapping. Two structural reasons: chrome floating over the canvas would sit between the finger and the selection border + handles the canvas itself draws, and a bar that mounted and unmounted in the flow would resize the canvas and re-run fit-to-view, visibly zooming the design mid-edit. Reserving the slot solves both.
- Touch targets ≥ 44×44 everywhere — non-negotiable.
- One primary action per screen. Header holds title + count; creation gets a FAB (56pt circle, ink fill), never a header button crowd.
- Safe areas respected on all edges; lists pad bottom beyond tab bar.

## 6. Motion & Interaction

Engine: reanimated springs only. Presets in `springs` tokens:

| Token      | Physics               | Use                                   |
| ---------- | --------------------- | ------------------------------------- |
| `ui`       | ζ 1.0, stiffness 260  | presses, toggles, thumbs              |
| `momentum` | ζ 0.8, stiffness 320  | flicks, throws                        |
| `sheet`    | ζ 0.85, stiffness 300 | sheet enter/exit                      |
| `exit`     | ζ 1.0, stiffness 380  | dismissals and other system responses |

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
- **`@expo/ui` allowed ONLY** for platform-behavior utilities behind platform-split modules: `community/Menu` (context menus), `universal/Slider`, `universal/Switch`/`Checkbox`. Each needs a `.web.tsx` fallback matching the custom kit.
- New dependencies require spec amendment (`.artifacts/00-design-direction.md`).

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
- ❌ Two near-identical competing metaphors (e.g., save-as-download next to export)
- ❌ AI copy clichés ("seamless", "elevate", "unleash") in any locale
