# Editor Font Family Picker — Design

**Date:** 2026-09-23
**Status:** Draft — awaiting review
**Author:** session `ses_f31b56d61ffdplZDcuwa5mzIXH`

## 1. Problem & goal

The editor's font picker is a flat list of weight-stamped keys. `Amiri` and
`Amiri-Bold` appear as peer buttons (`src/theme/fonts.ts:84-117`), weight is
controlled in two places (the Text sheet's flat list and the Style sheet's Bold
preset), and the choices are labelled in the **UI font** — so the user selects a
calligraphic face without ever seeing its letterform.

This spec replaces that with a **family → variant** picker: a grid of family
tiles, each rendered as a live specimen, that expands to reveal only the weights
that family actually ships. It also replaces the editor's bundled faces with a
set of **free, OFL, high-quality Arabic** typefaces that cover the calligraphic
styles CalliPro (Diwan) advertises with its commercial fonts.

**Success criteria**

- A user can see each family's letterform before selecting it.
- A family has exactly one place to pick weight; the Style-sheet Bold preset
  stays consistent with it.
- Single-weight families show no weight control and no non-functional Bold.
- No saved project breaks; no `fontKey` value is invalidated.
- The set is 13 families, all OFL, with no near-duplicate display faces.

## 2. Non-goals

- **Variable axes.** Variants are separate static TTFs. Driving `fvar` via Skia
  is out of scope (the bundled faces have no `fvar` table anyway —
  `src/theme/presentations.ts:12-25`).
- **Stylistic alternates** (`ssXX`, `cvXX`). No free Arabic face in this set
  ships them; the renderer exposes none.
- **Nasta'liq / Mirza.** Its hanging baseline is an open integration question;
  it gets its own spike, not this spec.
- **Diwani.** No genuine free Diwani exists; `Vibes` is an ornamental stand-in,
  labelled honestly.
- A two-pane or full-screen picker. Layout A (inline) is chosen.

## 3. Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Grouping | **By typeface** | Matches "variants of the same font" and the existing `family` field. |
| Layout | **A — family grid + inline variant chips** | Fits the current button-grid pattern, phone-first, RTL-friendly, no new screen. |
| Variant types | **Static weights only** | Uses the existing `fontKey` swap; no Skia pipeline change. |
| Weight ownership | **Variant row is the source of truth** | Removes the two-places-control-weight conflict. |
| New faces | **13 families** (7 new families, 6 kept) | Style parity with CalliPro without near-duplicates. |

## 4. The set (13 families)

`—` marks a family already bundled. All faces are SIL OFL.

| # | Family (key) | Label | Style tag | Variants |
| --- | --- | --- | --- | --- |
| 1 | `amiri` | Amiri | Naskh | `Amiri` (400), `Amiri-Bold` (700) — |
| 2 | `amiri-quran` | Amiri Quran | Quran | `AmiriQuran` (400) |
| 3 | `lateef` | Lateef | Traditional Naskh | `Lateef` (400), `Lateef-Bold` (700) |
| 4 | `noto-naskh` | Noto Naskh Arabic | Neutral Naskh | `NotoNaskhArabic` (400), `-Bold` (700) — |
| 5 | `aref-ruqaa` | Aref Ruqaa | Ruq'a | `ArefRuqaa` (400), `-Bold` (700) — |
| 6 | `rakkas` | Rakkas | Ruq'a Display | `Rakkas` (400) |
| 7 | `reem-kufi` | Reem Kufi | Modern Kufi | `ReemKufi` (400), `-Bold` (700) — |
| 8 | `noto-kufi` | Noto Kufi Arabic | Kufi | `NotoKufiArabic` (400), `-Bold` (700) — |
| 9 | `qahiri` | Qahiri | Antique Kufic | `Qahiri` (400) |
| 10 | `katibeh` | Katibeh | Thuluth-inspired | `Katibeh` (400) |
| 11 | `jomhuria` | Jomhuria | Thuluth Display | `Jomhuria` (400) |
| 12 | `lemonada` | Lemonada | Modern Display | `Lemonada` (400), `-Bold` (700) — |
| 13 | `vibes` | Vibes | Ornamental | `Vibes` (400) |

**New asset files (8):** `lateef-400/700`, `rakkas-400`, `qahiri-400`,
`katibeh-400`, `jomhuria-400`, `vibes-400`, `amiri-quran-400`.

**Retired from the picker:** `Cairo` ("عناصر / UI Sans"). It is the app's UI
font, not a calligraphy face. `Cairo` stays in `fontAssets` so any project that
already used it as a text `fontKey` still renders — it is only removed from the
picker.

**Labels are a review item.** The suggested family label is the typeface name,
shown in its own face; the style tag is the secondary line. An alternative is a
fixed specimen word (`خط`) plus a text label. Either way the tile must render a
real glyph from the family.

## 5. Data model

The **pure registry** lives in a new `src/theme/font-families.ts` that declares
**no imports** — the repo's `check-*.mjs` scripts transpile a standalone module
and evaluate it, and `fonts.ts` cannot be transpiled because its `fontAssets`
calls `require()` on `.ttf` files. `src/theme/fonts.ts` keeps `fontAssets` and
re-exports the registry so consumers keep importing from `@/theme`.

Everything below the registry stays data-driven.

```ts
export interface FontVariant {
  key: FontKey;        // 'Amiri-Bold' — the stored fontKey, unchanged
  labelAr: string;     // 'عريض'
  labelEn: string;     // 'Bold'
  weight: number;      // 400 | 700 | ...
}

export interface FontFamily {
  key: string;         // stable group id: 'amiri'
  labelAr: string;
  labelEn: string;
  styleTagAr: string;  // 'نسخ'
  styleTagEn: string;  // 'Naskh'
  defaultVariant: FontKey;
  variants: readonly FontVariant[];
}

export const fontFamilies: readonly FontFamily[] = [ /* 13 entries */ ];

export function familyForVariant(fontKey: string): FontFamily | undefined;
export function variantFor(fontKey: string): FontVariant | undefined;
```

**Invariants** (pinned by a check script, §11):

1. Every `variant.key` exists in `fontAssets`.
2. Every `family.defaultVariant` is a member of that family's `variants`.
3. No variant key appears in two families.
4. Every non-UI key in `fontAssets` belongs to exactly one family (no orphans).
5. No two families share a `labelEn` + `styleTagEn` pair (no near-duplicates).

**`calligraphyFonts` is retired.** Its two consumers change:

- `src/editor/export/svg.ts:31,94` — replace `familyForKey` with the registry
  (see §9).
- `src/editor/EditorScreen.tsx` — the picker renders `fontFamilies` instead.

`fontAssets` (the flat file registry) is unchanged, so `skia/text.ts:40`
(provider build) and `skia/use-text-layouts.ts` need no edits.

## 6. Picker UI (Layout A)

Lives in the **Text sheet**, replacing the flat `Button` wrap at
`src/editor/EditorScreen.tsx:2118-2128`. The live `TextPreview`
(`text-style-controls.tsx:242`) continues to sit above it.

**Structure**

1. **Family grid** — two columns, scrollable. Each tile:
   - renders the family name (or specimen word) **in the family's own face**;
   - shows the localized style tag as a caption;
   - marked selected via `variant="primary"` **and** `selected`, not colour alone.
2. **Variant row** — a horizontal chip row, shown only when
   `family.variants.length > 1`. Chips are single-select, labelled by localized
   variant name. Selecting one sets `draftFont` to that `variant.key`.
3. **Preview** — unchanged; updates as either level changes.

**States**

- No family selected with a multi-variant family → the `defaultVariant` chip is
  active.
- Single-variant family → no variant row (the tile selection is the whole choice).
- The sheet's confirm action is unchanged (`saveTextObject`).

**RTL** — grid and chip row inherit `I18nManager` direction; each tile's
specimen uses `writingDirection: isRTL ? 'rtl' : 'ltr'`, as `TextPreview` does.

**Accessibility**

- Tile: `accessibilityRole="button"`, `accessibilityState={{ selected }}`,
  `accessibilityLabel="{familyLabel}, {styleTag}"`.
- Variant chip: `accessibilityRole="button"`,
  `accessibilityState={{ selected }}`, labelled by variant name.
- Variant row is announced after the family tile (DOM/native order).

**Sizing** — tiles keep the existing button touch-target floor (≥ 44pt). The
specimen font size is a fixed preview size, not the draft size.

## 7. Weight ownership & presets

`src/theme/presentations.ts` keeps the Bold preset but it becomes a **shortcut**,
not a second source of truth:

- Variant row owns weight. Choosing a chip writes `fontKey` directly.
- **Bold preset**: selects the family's Bold variant (via
  `boldSiblingForKey`, unchanged). If none exists, the preset is **hidden**, not
  a silent no-op.
- **Classic preset**: resets `fontKey` to `familyForVariant(obj.fontKey)`
  `?.defaultVariant` instead of blindly stripping `-Bold` — so it returns to the
  family's declared default.
- After any variant change, the active-preset highlight resolves from the object
  state; a manual variant switch clears the `presentation.key` highlight rather
  than leaving a stale one.

## 8. Back-compat & migration

- **No project migration.** `fontKey` remains a flat string and every existing
  value (`Amiri`, `Amiri-Bold`, `ArefRuqaa`, …) is preserved as a variant key.
- **`Cairo`** stays in `fontAssets`; projects using it still render, it is just
  not offered in the picker.
- **Unknown keys** still fall back to `Amiri` in `skia/text.ts:91`.
- The `.midad` container format is untouched.

## 9. Render/export follow-through

The new registry lets the SVG exporter stop guessing. Today `familyForKey`
(variant → base family) means a **bold object exports a regular `@font-face`**:
`collectSvgFontFaces` looks up `fontAssets` by base family, so `Amiri-Bold`
embeds the 400 file and emits no `font-weight`. That is a latent export bug the
family model should close:

- Embed the **exact variant asset**, not the base family.
- Emit `font-weight: <weight>` in the `@font-face` and on the text run, so a
  viewer picks the right face.
- Keep the "unembeddable family is silently skipped" behaviour
  (`docs/editor-render-contract.md:181-186`).
- Update `docs/editor-render-contract.md` §8 in the same change.

The live canvas and PNG paths already select by `fontKey` and need no change.

## 10. Risks & open questions

| Risk | Impact | Mitigation |
| --- | --- | --- |
| **Startup/bundle cost** | `use-bootstrap.ts:58` loads every `fontAssets` entry at boot; 18 → 26 files, ~+2.5–3 MB | Measure the delta in Phase 2; if cold start regresses, lazy-load editor faces separately from UI fonts. |
| **Jomhuria/Katibeh are not true Thuluth** | Users expect Diwan Thuluth | Label honestly ("Thuluth-inspired" / "Thuluth Display"); no free true Thuluth exists. |
| **Single-weight families** | Bold inert on 6 families | Hidden, not no-op (§7). |
| **`Vibes` labelled ornamental** | Diwani parity gap | Accepted and documented; not called "Diwani". |
| **Asset availability** | A named OFL face may be unavailable at a pinned version | Phase 2 vendoring must pin the source repo + version. |

## 11. Verification

- **New check script `scripts/check-fonts.mjs`** pinning the §5 invariants,
  following the `check-groups.mjs` convention: transpile a standalone module and
  evaluate it. It evaluates `font-families.ts` directly, and regex-extracts the
  `fontAssets` keys from `fonts.ts` (which cannot be transpiled) to confirm every
  variant key has an asset. Registering it updates `scripts/verify.mjs`'s header
  count and `AGENTS.md`.
- `node scripts/verify.mjs` — full typecheck + lint + all checks.
- On device: cycle every family and variant; confirm shaping, that a
  single-variant family shows no chip row, and that Bold is absent for it.
- Export one SVG and one PNG per new face; confirm the embedded `@font-face`
  carries the right weight and renders bold correctly.
- Measure app size delta against the ~3 MB estimate.

## 12. Phases

1. **Registry** — add `fontFamilies`, helpers, retire `calligraphyFonts`; update
   `svg.ts` and `EditorScreen.tsx` type references. No UI change yet.
2. **Assets** — vendor and pin the 8 new TTFs; wire `fontAssets`; measure size.
3. **Picker UI** — Layout A in the Text sheet; RTL + a11y.
4. **Presets** — Bold shortcut + Classic default + highlight resolution.
5. **Export** — per-variant `@font-face` weight; update the render contract.
6. **Checks** — `scripts/check-fonts.mjs`; update `verify.mjs` header + AGENTS.md.

Each phase is independently verifiable with `node scripts/verify.mjs`.

## 13. Code map

| Concern | File |
| --- | --- |
| Family/variant registry (import-free) | `src/theme/font-families.ts` (new) |
| Asset map, roles, re-exports | `src/theme/fonts.ts` |
| Presentation presets, bold siblings | `src/theme/presentations.ts` |
| Text sheet picker | `src/editor/EditorScreen.tsx` |
| Preview, size gauge, steppers | `src/editor/text-style-controls.tsx` |
| Skia provider, shaping fallback | `src/editor/skia/text.ts` |
| SVG `@font-face`, family resolution | `src/editor/export/svg.ts` |
| Boot font loading | `src/hooks/use-bootstrap.ts` |
| UI strings | `src/i18n/strings.ts` |
| Render contract | `docs/editor-render-contract.md` |
| Font registry check | `scripts/check-fonts.mjs` (new) |
