---
title: Font pins — design
---

# Font pins — design

> **Status:** approved (2026-09-26) · **Plan:**
> [`../plans/2026-09-26-font-pins.md`](../plans/2026-09-26-font-pins.md)

## 1. Problem

The font picker is a single flat list. The bundled catalogue already holds ~22
families, and the on-demand Google Fonts section can surface 30 rows per search
out of a ~2100-family catalogue. A face a user reaches for every day sits
somewhere in that list, and in the Google section it can only be reached by
typing its name again on every visit.

The gallery and the selection rail already solve this for their own lists with a
**pin**: mark an item, and it collects at the front. The font picker has no such
affordance.

## 2. Decisions

| # | Decision | Value |
| - | -------- | ----- |
| D1 | Concept | **One** pin concept, matching the gallery/rail convention. No separate "favorite". |
| D2 | Grain | **Family / typeface**, not a specific weight variant. |
| D3 | Placement | A **Pinned** section fixed at the top of the picker, whenever it is non-empty, with or without a search. |
| D4 | Duplication | Pinned bundled families **also stay** in their normal spot in the list below. |
| D5 | Affordance | A trailing **pin button on every family row** (bundled and Google). No long-press menu. |
| D6 | Order | Most-recently-pinned first, matching `sortPinnedFirst`. No drag-reorder. |
| D7 | Persistence | **Device-local**, `midad:font-pins`, same shape as `src/storage/pins.ts`. Never in `.midad`. |
| D8 | Pruning | None. A pinned remote id that vanishes from the catalogue still renders by name. |
| D9 | Pin id | Namespaced strings: `family:<familyKey>` and `google:<fontId>`. |
| D10 | Residual UI | No "manage pins" surface in Settings; unpin from the picker row. |

## 3. Data model and identity (D2, D9)

A pinned entry names a **family**, so the picker resolves it against the same two
registries it already reads:

- a bundled family → its `FontFamily.key` from `fontFamilies` (`amiri`, `noto-naskh`, …)
- a remote family → its Fontsource id from the catalogue (`markazi-text`, …)

Those two namespaces can collide: `amiri` is both a bundled family key and a
Fontsource id. A bare slug is therefore ambiguous, and the pin id carries its
source:

| Source | Form | Example |
| ------ | ---- | ------- |
| Bundled | `family:<familyKey>` | `family:amiri` |
| Remote | `google:<fontId>` | `google:amiri` |

`src/theme/font-pins.ts` is the single owner of that format. It is **pure and
import-free** (the `src/theme/remote-fonts.ts` pattern), so
`scripts/check-font-pins.mjs` can transpile and evaluate it standalone:

```ts
export type FontPinSource = 'family' | 'google';
export type FontPinId = `family:${string}` | `google:${string}`;

export function familyPinId(familyKey: string): FontPinId;
export function googlePinId(fontId: string): FontPinId;
export function parseFontPinId(
  id: string,
): { source: FontPinSource; key: string } | null;
export function isFontPinId(id: string): id is FontPinId;

/** Move `id` to the front, or remove it when already present. */
export function togglePinnedId(ids: readonly string[], id: string): string[];
/** Prepend when pinning, filter when unpinning, or `null` when unchanged. */
export function setPinnedId(
  ids: string[],
  id: string,
  pinned: boolean,
): string[] | null;
```

Both builders template the prefix onto an already-slugged key; `parseFontPinId`
is the one validating gate — it requires `family:`/`google:` and a non-empty
`[a-z0-9-]+` remainder, and returns `null` for anything else (a bare slug, an
empty key, a wrong-case prefix, an extra segment). The two list operations keep
the store's ordering logic pure, so `check-font-pins.mjs` can pin it without
importing zustand. Resolving a parsed id to a
`FontFamily`/`RemoteFontFamily` is a plain `.find()` at the call site; there is
no second resolver to keep in step.

## 4. Persistence (D7, D8)

`src/storage/font-pins.ts` mirrors `src/storage/pins.ts` exactly: a zustand store
under `persist` → AsyncStorage key `midad:font-pins`.

```ts
interface FontPinsState {
  /** Most-recently-pinned first. */
  pinnedIds: string[];
  toggleFontPin: (id: string) => void;
  setFontPinned: (id: string, pinned: boolean) => void;
  unpinFont: (id: string) => void;
}
export const useFontPins = create<FontPinsState>()(/* persist(...) */);
```

`toggleFontPin` prepends on pin and filters on unpin; `setFontPinned` is a no-op
when the state already matches. There is **no pruning** (D8): unlike gallery pins,
which reference projects that can be deleted, a pinned remote id is still
renderable by name after it leaves the catalogue, and pruning against a
temporarily-offline catalogue would delete a real pin. The list is bounded by what
the user pins, so storage cannot grow without bound.

Pins are device-local and never enter the project document — no schema bump,
nothing for `import-project.ts` to validate. The cost, as with gallery pins, is
that a pin does not travel with an exported `.midad` file; that is the intended
trade (`docs/storage-format.md` §6).

## 5. Picker UI (D3, D4, D5, D6, D10)

`src/editor/font-picker-sheet.tsx` reads `useFontPins` and renders:

1. **The Pinned section**, at the top of the existing `ScrollView`, before the
   bundled matches. It renders whenever `pinnedIds.length > 0`, regardless of the
   search query. Its rows are built from the stored order (D6).
2. **The bundled matches**, unchanged, with a trailing pin button on each row — a
   pinned bundled family appears here **and** in the section above (D4).
3. **The Google Fonts section**, unchanged except for the same trailing pin button
   on each result row.

Each row's layout becomes: row body (existing content) taking the free width, then
an `IconButton name="pin"`. Tapping the button toggles the pin; tapping the body
keeps today's select/expand behaviour. The button reads as the selection rail's
pin control: its `accessibilityLabel` names what the press **will do** —
`t.common.pin` when unpinned, `t.common.unpin` when pinned — and its colour is
`c.ink` when pinned, `c.muted` when not.

To avoid two divergent copies of a row, the sheet extracts its bundled family row
and its remote family row into small presentational components that take a
`pinned` flag and `onTogglePin`. The Pinned section, the bundled list and the
Google results all render through them, so a pinned row behaves exactly like the
row it mirrors.

The sheet already clears `query` on close; the pin state is store-backed, so it
survives the close/reopen and an app restart.

## 6. Remote faces (never a silent Amiri)

A pinned remote family must render even when the Google catalogue has not been
fetched and when the face is not installed. The rules, in order:

- **The name never needs the catalogue.** `humanizeRemoteFontId(parseFontPinId(id).key)`
  gives "Markazi Text" from the id alone, so the pinned row always has a label.
- **The Arabic badge and the full weight chips need the catalogue.** The picker
  loads the cached catalogue when the sheet opens if any pinned id is remote
  (today it only loads on search). Resolved rows get the same badge and the same
  weight-chip download state machine as the Google results.
- **When the catalogue cannot be reached**, an installed pinned face is still
  selectable: its chips are derived from `useInstalledRemoteFontKeys` by matching
  `parseRemoteFontKey(key).id` against the pinned id. With neither catalogue nor
  installed faces, the row shows the name and the existing
  `fontCatalogFailed` retry copy.
- **Pinning never downloads.** Selecting an uninstalled face runs the existing
  `downloadRemoteFont` path from its chip; until then the key resolves to
  `remote-missing` and the picker shows the download/`✓` affordance, exactly as it
  does for a search result (`docs/editor-remote-fonts.md` §2).

A pinned remote id that no longer exists in the catalogue therefore degrades to a
name plus a failed/retry download — visible, never a silent substitution.

## 7. i18n

One new string, in both languages:

| Key | ar | en |
| --- | -- | -- |
| `editor.pinnedFonts` | `المثبّتة` | `Pinned` |

The pin/unpin/pinned words already exist as `common.pin`, `common.unpin` and
`common.pinned` and are reused. No new string for an empty state: the section is
simply absent when nothing is pinned.

## 8. Edge cases

- **Nothing pinned:** the section is absent and every row shows the "pin" state.
- **Pinning twice / unpinning twice:** `toggleFontPin` is idempotent per state;
  the store never holds a duplicate id.
- **The active family is pinned:** both the section row and the list row carry the
  selected state; changing weight updates both.
- **Bundled and remote share a slug (`amiri`):** the two pins are distinct ids and
  both render.
- **A pinned remote family with no catalogue and no install:** name-only row with
  the retry copy; never a crash.
- **Catalogue arrives after the sheet opened:** the pinned section re-renders with
  badges and chips when the fetch resolves; the fetch is cached weekly, so later
  opens are local.

## 9. Accessibility and RTL

The pin button is a real `IconButton` (`accessibilityRole="button"`) with a
localized label that states the action, so a screen reader announces "pin" or
"unpin" correctly. It sits at the row's trailing edge, which React Native mirrors
under RTL, so it lands on the left in Arabic — the same edge the row's chevrons
and `⋯` already use. The button's hit target is at least 44pt, and it is inset
from the row body so a pin tap cannot be mistaken for a select.

## 10. Checks and docs

- **New** `scripts/check-font-pins.mjs`, wired into `scripts/verify.mjs`. It
  transpiles `src/theme/font-pins.ts` and asserts: both builders produce the
  namespaced forms; `parseFontPinId` round-trips both; `family:amiri` and
  `google:amiri` parse to different sources; invalid inputs (`''`, `'amiri'`,
  `'family:'`, `'Family:amiri'`, `'google:a:b'`, `'google:Amiri'`) return `null`;
  and the module declares **no value imports**. It also asserts the store exists
  under `midad:font-pins` and that `font-picker-sheet.tsx` reaches the pure
  helpers.
- `scripts/verify.mjs`'s header comment and task list, `AGENTS.md`'s "twelve
  checks" line, and its contract table gain the new check.
- **New** contract `docs/editor-font-pins.md`, plus rows in `docs/index.md` §2,
  §3 and §4.

## 11. Testing

No test runner. The pin-id format and the store shape are pinned by
`scripts/check-font-pins.mjs`; the wiring is pinned by that script's source
assertions plus `tsc --noEmit` and `eslint`. The manual pass covers: pin/unpin a
bundled family, pin/unpin a Google family, the Pinned section ignoring the search
query, order changing as pins are added, pins surviving a restart, a pinned
uninstalled remote face downloading from its chip, a pinned remote face selected
offline after its catalogue cache was cleared, and RTL placement of the pin
button.

## 12. Out of scope

- Pinning a specific weight variant (D2).
- A separate "favorite" concept (D1).
- Drag-reordering pins (D6); order is pin time.
- Removing pinned families from the list below (D4).
- Pruning pins against the catalogue (D8).
- Any change to the `.midad` document or its version (D7).

## 13. Code map

| Concern | File |
| ------- | ---- |
| Pin id format, build/parse/validate, list ops (pure, import-free) | `src/theme/font-pins.ts` |
| Device-local pinned-family store | `src/storage/font-pins.ts` |
| Pinned section, per-row pin button, row extraction | `src/editor/font-picker-sheet.tsx` |
| Section copy (ar + en) | `src/i18n/strings.ts` |
| Executable spec for the pin id | `scripts/check-font-pins.mjs` |
| Contract | `docs/editor-font-pins.md` |
