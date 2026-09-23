# Runtime Font Library — Design

**Date:** 2026-09-23
**Status:** Draft — awaiting review
**Author:** session `ses_f31b56d61ffdplZDcuwa5mzIXH`

## 1. Problem & goal

The editor's faces are a closed, bundled set. A user who owns a font — a
licensed face, a font from a client, or a free one we did not ship — has no way
to use it. CalliPro offers "import external fonts"; this spec closes that gap.

**Goal:** let the user add a font from a **local file** or a **direct URL**, on
**native and web**, keep it in an **app-level library** available to every
project, and use it in the editor exactly like a bundled face.

**Success criteria**

- A valid `.ttf`/`.otf`, from either source, is usable as editor text after
  import, on canvas, in PNG and in SVG export.
- The font is available in every project on that device, across app restarts.
- An invalid or oversized file is rejected with a clear message, never handed to
  Skia.
- A project referencing a font that is no longer available still renders (Amiri
  fallback) and tells the user why.

## 2. Non-goals

- **Google Fonts by name.** No searchable catalog, no woff2 sourcing. Deferred
  to a later spec; this one covers file + URL only.
- **Syncing the library across devices.** The library is device-local by
  decision; a project opened elsewhere falls back.
- **Embedding loaded fonts into the `.midad` file.** The container format is
  untouched; export embeds fonts in SVG only, as today.
- **Variable axes and stylistic alternates.** A loaded variable font is used at
  its default instance; no axis UI.

## 3. Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Persistence | **App-level library** | Import once, use everywhere; matches CalliPro. Device-local is accepted. |
| Sources | **Local file + URL** | Covers real use; Google-by-name is a UX layer over the same pipeline. |
| Platforms | **Native + web** | The app ships both; the file/storage APIs differ and both are in scope. |
| Picker | **Separate "My fonts" section** | Keeps the curated bundled set visually distinct. |
| Missing font | **Amiri fallback + notice** | Never crash or blank; the user learns to re-import. |
| Provider | **Rebuild from a merged map** | Reuses `useFonts`; imports are rare so the rebuild cost is irrelevant. |

## 4. Data model

A loaded font is a single-variant `FontFamily` (from the previous spec's
registry) with a generated key.

```ts
// src/theme/custom-fonts.ts (pure, import-free)
export interface CustomFontRecord {
  /** Stable id, `custom:<hash>` — the stored fontKey. */
  id: string;
  /** Display name from the font's name table, or the filename as fallback. */
  familyName: string;
  /** OS/2 usWeightClass, or 400 when unreadable. */
  weight: number;
  fileName: string;
  source: 'file' | 'url';
  addedAt: number;
}

export function customFamilyFor(record: CustomFontRecord): FontFamily;
export function mergeFamilies(custom: CustomFontRecord[]): FontFamily[];
```

- `familyForVariant` checks bundled families first, then the custom list.
- A custom family's `variants` has exactly one entry; `defaultVariant` is its id.
- **Each imported file is its own family in this delivery** — even a Regular and
  a Bold file from the same typeface appear separately. Grouping same-named
  custom files into one family is a deliberate later enhancement, not part of
  this spec.

## 5. Storage

One interface, two implementations:

```ts
// src/storage/font-library.ts  (native)
// src/storage/font-library.web.ts (web)
export interface FontLibrary {
  list(): Promise<CustomFontRecord[]>;
  add(file: FontInput): Promise<CustomFontRecord>;
  remove(id: string): Promise<void>;
  /** Raw bytes for SVG embedding, or null when absent. */
  bytesFor(id: string): Promise<Uint8Array | null>;
}
```

- **Native:** TTF bytes under the `expo-file-system` document directory, plus
  `font-library.json` as the manifest. `remove` deletes both.
- **Web:** an IndexedDB store holds the `ArrayBuffer` keyed by id, and the
  manifest object. localStorage is not used — it cannot hold binary.
- **Missing file tolerance:** if a manifest entry's bytes are gone, `list`
  reports the record but `bytesFor` returns null; the entry is treated as
  missing (§8).

## 6. Import flow

Entry point: an **"Add font"** action in the text sheet, opening a small sheet.

1. **Choose source** — *Pick a file* (`expo-document-picker`) or *Paste a URL*.
2. **Acquire** — read the picked file, or `fetch` the URL to a temp buffer.
3. **Validate** (before anything is stored or given to Skia):
   - magic bytes ∈ `00 01 00 00`, `OTTO`, `true`, `ttcf`;
   - size ≤ 8 MB;
   - the `name` table parses to a non-empty family name.
   Any failure stops here with a specific message.
4. **Parse metadata** — family name (`name` table id 1/16), weight (`OS/2`
   `usWeightClass`, bold bit in `head.macStyle` as fallback).
5. **Store** — `fontLibrary.add(...)` writes bytes + manifest.
6. **Refresh** — the provider rebuilds and the face appears under *My fonts*.

URL fetch is plain `fetch`; there is no server proxy. Redirects are followed;
non-200 or non-font content fails validation.

## 7. Rendering integration

Two systems must both learn the font — missing either is the silent failure:

- **Skia (canvas + PNG):** `useParagraphFonts()` becomes a merged provider.
  Feed `useFonts({ ...staticFontAssets, ...loadedFontAssets })`; when the library
  changes the map changes, the provider rebuilds, and text re-lays out once.
  Loaded bytes become a Skia `DataModule`: on native the stored file URI, on web
  a blob URI — both via the existing `toFontSource`.
- **React Native `<Text>` (the live preview):** `expo-font.loadAsync` registers
  the family for plain RN text, since the preview is not Skia
  (`text-style-controls.tsx:341`). Loaded on library change alongside the
  provider.

A `useFontLibrary()` hook owns: the manifest, the loading of each font into both
systems, and a `version` counter consumers can depend on.

## 8. Picker & missing font

- `FontPicker` keeps the bundled grid and adds a labelled **My fonts** section
  below it, listing custom families. Selecting one behaves exactly like a
  bundled family; a custom family has no variant row (single weight).
- **Remove** is a long-press on the tile, with confirm.
- **Missing font:** when the current `fontKey` is not in either registry,
  rendering falls back to Amiri (existing `skia/text.ts:91` and `svg.ts`
  behaviour) and the text sheet shows a subtle notice offering re-import.
  `defaultVariantForKey` and `boldSiblingForKey` already tolerate unknown keys.

## 9. Export

`svg.ts` is already async (`collectSvgFontFaces`), so the resolver is injected:
`familyForKey` returns the custom id, and the font-face collector asks
`fontLibrary.bytesFor(id)` for the base64 payload. An unavailable custom font
falls back to Amiri, matching the canvas. PNG needs no change beyond the merged
provider.

## 10. Security & robustness

Untrusted font data reaches a C++ paragraph builder, so validation is the gate,
not a nicety:

- Validate magic bytes and size **before** constructing a `Skia.Typeface`.
- Do all metadata reading behind `try/catch`; a parse failure is a rejection,
  not an exception that escapes to the UI.
- Cap the library size (e.g. 50 fonts) so it cannot grow without bound.
- Treat the URL as untrusted input: no auth headers, no `file://`, size cap
  enforced while streaming.

## 11. Dependencies

- **No new runtime dependency is needed.** `expo-document-picker`
  (`~57.0.2`), `expo-file-system` (`~57.0.7`) and `expo-font` (`~57.0.4`) are
  already in `package.json`.
- **No font-parsing dependency.** A minimal in-repo TTF metadata reader for the
  `name` and `OS/2` (and `head`) tables, in a pure import-free module so a
  `check-custom-fonts.mjs` script can pin it against fixture bytes — the repo's
  established `check-*` pattern.

## 12. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Untrusted font crashes Skia | App crash | Validate + `try/catch`; only construct typefaces after validation. |
| Web provider + blob URI | Font silently unused | Explicit web path + a device/browser check per face. |
| Skia and expo-font drift | Preview ≠ canvas | Both loaded in one `useFontLibrary` step, behind one `version`. |
| Provider rebuild re-lays out text | One visible reflow per import | Accepted; imports are rare. |
| Device-local library | Shared project shows Amiri | The missing-font notice (§8); embedding is a future spec. |

## 13. Phases

1. **Parser + check** — `custom-fonts.ts` metadata reader + `check-custom-fonts.mjs`.
2. **Library** — `font-library.ts` (+ `.web.ts`), manifest, add/remove/bytesFor.
3. **Rendering** — merged provider + `useFontLibrary`, RN `expo-font` load.
4. **Picker** — "My fonts" section, remove, missing-font notice.
5. **Import UI** — Add-font sheet: file picker + URL, validation feedback.
6. **Export** — inject the resolver into `svg.ts`.
7. **Verify** — `node scripts/verify.mjs` plus device + browser checks.

## 14. Verification

- `node scripts/check-custom-fonts.mjs` — parser fixtures: a valid TTF, a
  truncated file, a non-font, and a font with no `name` table.
- `node scripts/verify.mjs` — full suite (register the new check; update the
  count in `scripts/verify.mjs` and `AGENTS.md`).
- Device: import a file and a URL, restart, confirm both persist and render.
- Browser: same, confirming IndexedDB persistence.
- Export: SVG for custom-font text embeds the file; removing the font then
  exporting falls back to Amiri.
- Negative: a renamed `.png` as `.ttf` is rejected with the validation message.

## 15. Code map

| Concern | File |
| --- | --- |
| Custom family records, merge | `src/theme/custom-fonts.ts` (new) |
| Library interface | `src/storage/font-library.ts` (new) + `.web.ts` |
| Merged provider, loading | `src/editor/skia/text.ts`, `src/hooks/use-font-library.ts` (new) |
| Picker "My fonts" | `src/editor/font-picker.tsx` |
| Add-font sheet | `src/editor/add-font-sheet.tsx` (new) |
| SVG resolver | `src/editor/export/svg.ts` |
| Parser check | `scripts/check-custom-fonts.mjs` (new) |
