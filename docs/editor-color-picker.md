# Editor Color Picker

> The Colors tool's picker: how a typed colour becomes a stored one, where the
> picker lives, and what one visit costs in undo. This is the behavior contract;
> when code and this document disagree, fix the code.

---

## 1. Why this module exists

Three things decide how this is built, and none is visible from the code alone:

- **A color has exactly one stored form.** The document, `Skia.Color`, the SVG
  exporter and the content palette all read `#rrggbb`. Letting a second spelling
  into the document would mean a second parser in every consumer.
- **Trying colors must be cheap to undo.** A picker invites experimenting, so one
  visit to the sheet is one history step, not one step per tap.
- **The rail had no room for it.** The six-swatch strip lived in the context zone,
  which is capped at 40% of the rail; on a phone it scrolled and stole width from
  the selection actions. The picker is a sheet now, and the zone holds nothing for
  the Colors tool.

## 2. Placement — the sheet is the tool's whole surface

Pressing the Colors tool selects it (for the rail highlight) and opens
`ColorPickerSheet`. It mirrors the Text and Glyphs tools, whose presses also open
a sheet.

The context zone no longer renders anything for `tool === 'color'`:
`hasContext` is `splitNotice !== null || tool === 'background'`. Nothing
colour-related sits in the rail, so the zone is never charged against the
actions' width budget for it (`editor-selection-bar.md` §6).

The background tool is untouched: its paper swatches and image picker stay in the
zone, and they still use the shared `colorStrip` / `colorSwatch` styles.

## 3. `parseColor` — one canonical form

`parseColor(input): string | null` (`src/theme/color.ts`) is the single gate for a
typed colour. It accepts the common CSS spellings and returns canonical lowercase
`#rrggbb`, or `null`:

| Input                                                      | Result                                               |
| ---------------------------------------------------------- | ---------------------------------------------------- |
| `#111111`, `111111`, `#ABC`, `abc`, surrounding whitespace | the colour, normalized                               |
| `#RGB` shorthand                                           | expanded, never padded                               |
| `rgb(r,g,b)`                                               | normalized hex                                       |
| `rgba(r,g,b,a)`                                            | normalized hex — **alpha is validated then dropped** |

Out-of-range components (`rgb(300,0,0)`) and out-of-range alpha
(`rgba(0,0,0,2)`) are **rejected, not clamped**: a silent clamp hides a typo.
Alpha is dropped because every object already carries a separate `opacity`; a
second alpha in the string would be a contradictory control.

`scripts/check-color.mjs` is the executable specification for this table and for
the reducer in §4.

## 4. The recent-colour history

Custom entries are remembered in `useSettings.recentColors` under
`midad:settings`, beside `selectionBarActions`. Like that preference it is
**device-local** — it never enters the project document, so there is no schema
bump and nothing for `import-project.ts` to validate.

The content palette (`inkSwatches`, `paperSwatches`, `DEFAULT_INK`,
`DEFAULT_PAPER`) is **already canonical lowercase hex**, and `check-color.mjs`
pins that: a preset tap writes the swatch value verbatim, so an uppercase preset
would store a second spelling and miss the active-swatch highlight.

`pushRecent(colors, color, max)` (`src/theme/color.ts`) moves a colour to the
front, drops any earlier copy case-insensitively, and caps the list at
`RECENT_COLORS_MAX = 8`. It is pure, so `check-color.mjs` pins the dedupe and the
cap rather than leaning on a settings-store diff. Only **custom** entries are
recorded (`onChange`'s `source === 'custom'`); tapping a preset does not, since
the preset grid already shows those.

A stale or absent array reads as empty: the sheet renders the recent row only
when `recentColors.length > 0`.

## 5. Undo — one step per visit

The first colour change in a visit calls `store.snapshot()`; later changes update
live without one. The flag (`colorSession`) is reset when the Colors tool is
pressed, so each visit is one step — the same shape as `beginFontSizeDrag` for
the font-size gauge.

The snapshot is **lazy**, taken on the first change rather than on open, so
opening and closing the sheet without picking anything leaves no empty undo step.

`patchSelectedAll` keeps its one-snapshot-per-call behavior for the opacity
stepper and is not the path colour takes (`applyColor` in
`EditorScreen.tsx` is).

## 6. The sheet is presentational

`ColorPickerSheet` reads no editor store: it raises
`onChange(color, 'preset' | 'custom')` and edits local draft/validation state.
The screen owns applying the colour and the undo session. This is the same shape
as `font-picker-sheet.tsx`, so the picker can be reused (for example from the Text
sheet) without moving editor logic into it.

The custom field commits on submit (`onSubmitEditing`) and on blur. Empty input
is a no-op, not an error. An invalid entry turns the hint into the error copy and
the field border to the danger colour; editing again clears it.

The body scrolls (the panel is capped at 82% of the window) and the Done button
sits outside the scroller, so a full recent list on a small screen cannot hide the
confirm control. This mirrors `font-picker-sheet.tsx`.

## 7. Edge cases

- **Nothing selected:** `applyColor` returns before touching the store, so the
  sheet cannot throw or write history.
- **A preset tapped while the field holds invalid text:** the preset commits; the
  field keeps its text.
- **RTL:** the field and the labels follow `isRTL` for direction and alignment;
  the sheet uses `closeButton` because a web modal has no drag-to-dismiss.

## 8. Code map

| Concern                                                     | File                                |
| ----------------------------------------------------------- | ----------------------------------- |
| `parseColor`, `pushRecent`                                  | `src/theme/color.ts`                |
| The picker UI                                               | `src/editor/color-picker-sheet.tsx` |
| Opens the sheet, `applyColor`, `colorSession`, `hasContext` | `src/editor/EditorScreen.tsx`       |
| `recentColors`, `pushRecentColor`, `RECENT_COLORS_MAX`      | `src/storage/settings.ts`           |
| Picker copy (ar/en)                                         | `src/i18n/strings.ts`               |
| Parser + reducer check                                      | `scripts/check-color.mjs`           |
| The zone's contents after the move                          | `editor-selection-bar.md` §6        |
| The stored colour field on an object                        | `storage/project-schema.ts`         |
