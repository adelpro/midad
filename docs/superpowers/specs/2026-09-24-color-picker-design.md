---
title: Color picker — design
---

# Color picker — design

> **Status:** approved (2026-09-24) · **Plan:**
> [`../plans/2026-09-24-color-picker.md`](../plans/2026-09-24-color-picker.md)

## 1. Problem

The Colors tool renders its six ink swatches as a horizontal strip inside the
context zone of the selection rail (`EditorScreen.tsx`). In Arabic the context
row is RTL, so that zone sits at the **left** of the row while the selection rail
sits at the right. The zone is capped at `CONTEXT_ZONE_MAX_SHARE = 0.4` of the
usable width, so on a small screen the strip scrolls/clips and steals width from
the selection actions — the crowded, overlapping row in the report.

The strip also offers only six fixed colors; there is no way to enter an
arbitrary one.

## 2. Decisions

| # | Decision | Value |
| - | -------- | ----- |
| D1 | Placement | **A** — the Colors tool opens a Color sheet; nothing color-related stays in the context rail. |
| D2 | Picker fidelity | Preset swatches + a custom text input + a preview. **No** spectrum/hue slider. |
| D3 | Recents | Included: device-local `recentColors`, capped at 8, most-recent-first, case-insensitively deduped. |
| D4 | Formats | Input accepts `#RGB`, `#RRGGBB`, `rgb(r,g,b)`, `rgba(r,g,b,a)`; stored canonically as `#rrggbb`. Alpha is validated then dropped. |
| D5 | Undo | **Per-session**: one history step per sheet visit, snapshotted lazily on the first change. |

## 3. Placement (D1)

The Colors tool press mirrors the Text and Glyphs tools: it selects the tool (for
the rail highlight) and opens a sheet. One consequence is deliberate:

- The context zone no longer holds anything for the Colors tool, so
  `hasContext` drops the `tool === 'color'` case and the zone is charged nothing.
- The background tool is untouched; its paper swatches and image picker stay in
  the zone, and its swatch styles are shared with the new picker.

This removes the control from the element-toolbox row entirely, which is what the
report asked for, and gives the picker a full-height sheet to live in.

## 4. Components and files

| File | Responsibility |
| ---- | -------------- |
| `src/theme/color.ts` | `parseColor(input): string \| null` — pure, import-free normaliser. |
| `src/editor/color-picker-sheet.tsx` | `ColorPickerSheet` — the picker UI. |
| `src/editor/EditorScreen.tsx` | Opens the sheet, applies the color, removes the old strip. |
| `src/storage/settings.ts` | `recentColors` + `pushRecentColor`. |
| `src/i18n/strings.ts` | New copy, ar + en. |
| `scripts/check-color.mjs` | Standalone parser check. |

`ColorPickerSheet` is presentational: it raises `onChange(color, source)` and
never reads the editor store, matching `font-picker-sheet.tsx`.

## 5. Data flow

```
Colors tool press
  → selectTool('color'); colorSession = false; setColorSheetOpen(true)
ColorPickerSheet
  → swatch tap        → onChange(hex, 'preset')
  → custom field valid → onChange(hex, 'custom')
EditorScreen.applyColor(hex, source)
  → snapshot on the first change of the visit
  → updateObject(color) for the whole selection
  → source === 'custom' → pushRecentColor(hex)
```

The sheet stays open after a change so the canvas behind it is the live preview.

## 6. Persistence (D3)

`recentColors: string[]` lives in `useSettings` under `midad:settings`, beside
`selectionBarActions`. Like that preference it is **device-local** and never
enters the project document — no schema bump, nothing for `import-project.ts` to
validate. `pushRecentColor` puts the color at the front, removes any earlier
copy (case-insensitive), and slices to `RECENT_COLORS_MAX = 8`.

## 7. Color formats (D4)

`parseColor` is the single gate. It accepts the common CSS spellings and returns
canonical `#rrggbb`, or `null`. The leading `#` is optional and case is ignored.
Hex shorthand is expanded, not padded. `rgb()`/`rgba()` components must be whole
numbers in 0–255 and alpha a number in 0–1; out-of-range values are **rejected,
not clamped**, because a silent clamp hides a typo. Alpha is accepted and then
dropped: every object already carries a separate `opacity`, so keeping alpha in
the string would be a second, contradictory control.

Storing one canonical form is the point: the palette, `Skia.Color`, the SVG
exporter and the render contract all assume hex, so no consumer needs a second
parser.

## 8. Undo (D5)

The first change in a visit calls `store.snapshot()`; later changes update live
without one. This is the shape the font-size gauge already uses
(`beginFontSizeDrag` … `onSlidingComplete`), so a whole "try a few colors"
session undoes as one step. The flag is reset when the Colors tool is pressed
again, so a new visit is a new step. Opening and closing without changing
anything leaves no empty step, because the snapshot is lazy.

`patchSelectedAll` keeps its snapshot-per-call behavior for the opacity stepper
and is not reused here.

## 9. Edge cases

- **Nothing selected:** the sheet is inert (no selection to patch). The preview
  falls back to `DEFAULT_INK`.
- **Empty or invalid custom input:** commit is a no-op; the hint turns to the
  error copy and the field border takes the danger color. Clearing the field
  clears the error.
- **A preset tapped while the field holds invalid text:** the preset commits; the
  field keeps its text.
- **Recents corruption:** `recentColors` is read through the store; a stale or
  missing array is treated as empty by the sheet (`recentColors.length > 0`).
- **Duplicate hex in different case:** deduped case-insensitively.

## 10. Accessibility and RTL

Every swatch is a `Pressable` with `accessibilityRole="button"` and the hex as
its label; the active swatch carries `accessibilityState={{ selected }}`. The
custom field is a real `TextInput` with a localized placeholder and follows
`isRTL` for direction and alignment. The sheet uses `closeButton` (modal
presentation on web has no drag-to-dismiss).

## 11. Testing

No test runner: the parser is pinned by `scripts/check-color.mjs` (wired into
`scripts/verify.mjs`), and everything else by `tsc --noEmit` + `eslint`. The
manual pass covers RTL, small-phone width, invalid input, and a custom color
round-tripping into Skia and the SVG export.

## 12. Out of scope

- A spectrum/hue picker (D2).
- Alpha in the color string (opacity covers it).
- Background/paper picking (unchanged).
- A color field inside the Text sheet (reusable later; not this change).
