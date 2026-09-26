# Editor font pins

> Owns the device-local pin preference behind the font picker's Pinned section:
> how a pinned family is identified (the two namespaces that keep `family:amiri`
> and `google:amiri` apart), where the list lives, how the picker presents it,
> and what a pinned remote face does when its catalogue or its bytes are
> missing. It does not own the remote-font format — `editor-remote-fonts.md`
> does. When this document and the code disagree, fix the code.

---

## 1. Identity

A pinned entry names a **family**, not a weight variant. Families come from two
registries whose keys can collide (`amiri` is both a bundled family key and a
Fontsource id), so the pin id carries its source:

| Source  | Form              | Example        |
| ------- | ----------------- | -------------- |
| Bundled | `family:<key>`    | `family:amiri` |
| Remote  | `google:<fontId>` | `google:amiri` |

`src/theme/font-pins.ts` owns the format. It is **pure and import-free**, so
`scripts/check-font-pins.mjs` transpiles and evaluates it standalone.
`parseFontPinId` is the one validating gate: `family:`/`google:` plus a non-empty
`[a-z0-9-]+` remainder, or `null`. It also owns the store's ordering
(`togglePinnedId`, `setPinnedId`) so that logic is testable without zustand.

## 2. Storage

`src/storage/font-pins.ts` is a zustand store under `persist` →
AsyncStorage key `midad:font-pins`, the same shape as `src/storage/pins.ts`:
`pinnedIds: string[]` most-recently-pinned first, plus `toggleFontPin`,
`setFontPinned` and `unpinFont`.

Pins are **device-local** and never enter `MidadProject`: no schema bump, nothing
for `import-project.ts` to validate. The cost is that a pin does not travel with
an exported `.midad` file.

There is **no pruning**. A pinned remote id that leaves the catalogue is still
renderable by name (`humanizeRemoteFontId`); pruning against a temporarily
offline catalogue would delete a real pin.

## 3. Picker

`FontPickerSheet` renders the **Pinned** section at the top of its scroll whenever
`pinnedIds` is non-empty — with or without a search. Every bundled and Google
family row carries a trailing pin control; a pinned bundled family also stays in
its normal place in the list below. The control's label names what the next press
will do (`common.pin` / `common.unpin`), matching the selection rail.

## 4. Remote faces

A pinned remote row never needs the catalogue for its **name**
(`humanizeRemoteFontId`). The Arabic badge and the full weight chips do, so the
picker loads the cached catalogue on open when any pin is remote. When the
catalogue cannot be reached, an installed face's chips are derived from
`useInstalledRemoteFontKeys` via `parseRemoteFontKey`, so it stays selectable
offline. Pinning never downloads: selecting an uninstalled face runs the existing
`downloadRemoteFont` state machine, exactly as a search result does. A face that
cannot be resolved is shown, not silently substituted — `editor-remote-fonts.md`
§2 governs.

## 5. What the check pins

`scripts/check-font-pins.mjs` (wired into `verify.mjs`) pins the builders, the
parse round-trip, the `family:amiri` / `google:amiri` distinction, the reject
set, the two list operations, the module's import-free purity, and that the store
and the picker reuse the pure core.

## 6. Code map

| Concern                                              | File                               |
| ---------------------------------------------------- | ---------------------------------- |
| Pin id format, build/parse/validate, list ops (pure) | `src/theme/font-pins.ts`           |
| Device-local pinned-family store                     | `src/storage/font-pins.ts`         |
| Pinned section, per-row pin control, row components  | `src/editor/font-picker-sheet.tsx` |
| Section copy (ar + en)                               | `src/i18n/strings.ts`              |
| Executable spec                                      | `scripts/check-font-pins.mjs`      |
