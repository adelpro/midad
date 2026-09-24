# Editor remote fonts

> Owns the runtime Google Fonts feature: how a face is identified, where the
> catalogue and the files come from, how the device caches them, and the rules
> that keep a face from silently turning into Amiri. The bundled registry
> (`fonts.ts`, `font-families.ts`) is a separate contract — remote land never
> touches it. When this document and the code disagree, fix the code.

---

## 1. Identity and sources

A runtime face is a `fontKey` of the form `remote:<fontsource-id>:<weight>`
(e.g. `remote:markazi-text:400`), the Fontsource slug lowercased with
non-alphanumerics collapsed to hyphens (`normalizeRemoteFontId`) plus a
three-digit CSS weight (100–900). The format is pinned by
`REMOTE_FONT_KEY_PATTERN` (`/^remote:[a-z0-9-]+:[1-9]\d{2}$/`) and by
`scripts/check-remote-fonts.mjs`.

One data source serves the whole feature — the **Fontsource** directory and CDN,
which mirror `github.com/google/fonts` (the same repo the bundled faces were
vendored from):

- Catalogue: `https://api.fontsource.org/v1/fonts` (~2100 families, `type: 'google'`)
- Files: `https://cdn.jsdelivr.net/fontsource/fonts/<id>@latest/<subset>-<weight>-normal.ttf`
  (`remoteFontTtfUrl`)

Both hosts send `Access-Control-Allow-Origin: *` (verified), so native and web
share one code path — no User-Agent tricks, no platform split for the download.
Google's own endpoints are deliberately **not** used: `fonts.google.com/metadata/fonts`
sends no CORS header (browsers won't read it) and
`fonts.googleapis.com/css2` serves woff2 to modern browsers while browsers
forbid overriding `User-Agent` — Fontsource's per-subset TTF is the one format
both Skia FreeType and the web text renderer accept unchanged.

## 2. Face status — never a silent Amiri

`faceStatusForKey(key, isBundled, isRemoteInstalled)` returns one of:

| Status               | When                                        | What the UI must do                                             |
| -------------------- | ------------------------------------------- | --------------------------------------------------------------- |
| `'bundled'`          | key is a bundled registry entry             | nothing special                                                 |
| `'remote-installed'` | `remote:<…>` and the face is on this device | use it                                                          |
| `'remote-missing'`   | `remote:<…>` but not downloaded here (yet)  | offer to download; render Amiri until resolved — never silently |
| `'unknown'`          | anything else                               | treat as missing, surface it                                    |

Precedence is deliberate: a bundled key can never be `remote-missing`, and an
unknown key is `'unknown'`, **never** `'bundled'`. The old pattern
(`Object.hasOwn` over the bundle registry, else Amiri) must be _replaced_, not
left beside the resolver — a face that vanished from the registry then fails
loudly instead of rendering in the wrong script.

`remote-fonts.ts` is pure and import-free: the real predicates live in the
callers (`Object.hasOwn` over the registry; the cache's `isRemoteFontInstalled`),
so the check script can transpile and evaluate it standalone.

### Render-time resolution

The Skia paragraph builder resolves a text object's family through the set of
faces the **latest built provider** registered — `registeredFamilies` in
`src/editor/skia/text.ts` (every bundled key plus the installed remote faces).
A remote key that is installed renders; any key the provider does not know
falls back to Amiri. That fallback is the _render_ fallback only: the same
state machine above decides what the UI says, the missing-font banner names
every `remote-missing` face on document open and offers the download, and a
_new_ document can only name a face by downloading it from the picker first —
so Amiri in the meantime is a visible interim, never a silent substitution.

## 3. Platform cache semantics

The cache module mirrors `src/storage/thumbs.ts` (single module, `Platform.OS`
split):

- **Native**: TTF bytes are written to `Paths.cache` (dynamic
  `expo-file-system` import); the index entry carries the `file://` URI
  (`source: 'file'`).
- **Web**: no bytes are stored (Android AsyncStorage defaults to a 6MB total
  budget; a whole face would eat it). Install fetches the CDN URL to validate
  it and warm the browser HTTP cache, and the entry carries the URL itself
  (`source: 'url'`).
- Index: `midad:remote-fonts:v1` in AsyncStorage, `fontKey → entry`
  (`{ fontKey, id, weight, subsets, uri, source, downloadedAt }`).

Native cache files are OS-purgeable: treat a missing file as `remote-missing`,
not as data loss — `isRemoteFontInstalled` / `uriForRemoteFont` verify file
existence and `listInstalledRemoteFonts` skips purged entries. A downloaded face
is device-local by design; a `.midad` referencing it on another device goes
through the `remote-missing` re-download prompt (the key is platform-agnostic,
so web and native resolve the same face).

## 4. Catalogue

`getRemoteFontCatalog()` fetches the Fontsource directory, keeps only
`type: 'google'` faces, normalises ids, and caches the JSON in AsyncStorage
(`midad:remote-font-catalog:v1`, refreshed at most weekly; a stale cache beats
a network failure). `filterRemoteFontFamilies(families, query, limit)` is pure:
prefix matches first, then substring, capped. Arabic support is
`family.subsets.includes('arabic')` — the picker badge lives in Phase 2, the
data is here.

## 5. What the check pins

`scripts/check-remote-fonts.mjs` (wired into `verify.mjs`) transpiles
`remote-fonts.ts` and asserts: valid/invalid key formats (lowercase slug only),
build/parse round-trip, id and weight normalisers, the display-label helpers
(`humanizeRemoteFontId`, `remoteFontLabel`), the face-status state machine, the
CDN URL builder, and that `remote-fonts.ts` declares **no imports** and never
mentions the bundled registry or React Native. It also asserts the catalogue
and cache modules exist and reuse the pure helpers.

## 6. Editor wiring (Phase 2)

### Registration is one door

`src/storage/remote-font-registry.ts` owns both registrations, so they can
never drift. `downloadRemoteFont(id, weight)` (the only way a face enters the
app — a picker weight chip or the missing-font banner) installs into the cache
and reconciles `refreshInstalledRemoteFonts`, which:

1. registers every cached face with **expo-font** under its `fontKey` family
   name — this is what makes RN `<Text>`/`TextInput` paths (the TextPreview,
   the FontField specimen) render remote faces; and
2. publishes the installed snapshot — a stable `ReadonlySet<string>` that
   `useInstalledRemoteFontKeys` (`src/hooks/use-installed-remote-fonts.ts`,
   a `useSyncExternalStore` hook) exposes, and that is only replaced when its
   content changes (so a no-op reconcile notifies nobody).

The snapshot mirrors what expo-font actually holds, not the cache index: a face
whose file was purged (native) is scanned out, and a face that fails to
register is left out so the UI can offer a retry. `missingRemoteFontKeys(keys)`
is the document-level query the banner runs.

> **Unverified native risk (manual-test item).** expo-font registers each face
> under its `fontKey` family name, which contains colons
> (`remote:markazi-text:400`). iOS family-name handling of the colon is not yet
> verified on a device; on web the same name is used verbatim in `@font-face`,
> which is safe. The registration failure is contained either way: the face is
> left out of the snapshot and the UI offers a retry — never a crash.

### The Skia provider rebuilds from the same snapshot

`loadParagraphFonts` (`src/editor/skia/text.ts`) registers every bundled family
**and every installed remote face** (TTF bytes from the cache — re-resolved CDN
URL on web, file read on native) under its `fontKey`, and only then swaps the
`registeredFamilies` mirror the paragraph builder resolves through. A failed
load leaves the previous mirror intact. `useParagraphFonts` reconciles expo-font
first and rebuilds the provider whenever `useInstalledRemoteFontKeys`' snapshot
changes, so downloading a face re-shapes the canvas in place — `useTextLayouts`
already memoizes on the provider identity.

### Picker: search, badge, weight chips, download

The Google Fonts section in `src/editor/font-picker-sheet.tsx` appears while
the picker's search box is non-empty (the box doubles as its search field):
each family row shows the display name and an Arabic badge
(`subsets.includes('arabic')` → "يدعم العربية" / "بدون عربي"), and expands to
one chip per weight. A chip is a state machine — `downloading` (spinner), then
`installed` (`✓ <label>`), or `retry` on failure — and tapping it downloads
and registers the face (`downloadRemoteFont`), then selects it
(`onChange(remoteFontKey(id, weight))`). Installed chips stay tappable to
re-select; no re-download. The catalog fetch is cached (weekly), the search is
debounced, and a failed fetch shows "تعذّر الوصول إلى مكتبة خطوط Google" with
no crash.

Each weight chip is labelled the way the bundled registry names variants —
400 → "عادي"/"Regular", 700 → "عريض"/"Bold", any other weight keeps its number
(`fontWeightRegular`/`fontWeightBold`). And the installed snapshot warms from
the cache on first use in a session (`useInstalledRemoteFontKeys`'s mount
effect), so faces installed in a previous launch already show `✓` on the
session's first open instead of flipping a beat later.

### Missing-font banner

On open, `EditorScreen` scans the document's text-object `fontKey`s
(`missingRemoteFontKeys`) and, when any are missing, shows a strip under the
top bar: title + body naming the situation, and a download action that fetches
each missing face and clears the strip (the scan re-runs on every installed-set
change). The scan is keyed on the _content_ of the document's font keys, so a
drag (which re-creates the project object every frame) never re-reads
AsyncStorage.

## 7. Exports and hardening (Phase 3)

- **SVG embeds remote faces.** `familyForKey` in `export/svg.ts` resolves a
  remote key to a per-face display name — `Family Weight` (e.g. `Markazi Text
400`) — and `collectSvgFontFaces` inlines the installed TTF bytes
  (`bytesForRemoteFont`) under that name. `textToSvg` single-quotes any family
  name that is not a bare CSS identifier, so the `<text font-family>` matches
  the `@font-face` rule. A remote face that is **not** installed is left
  unembedded and the viewer substitutes — never a different embedded face
  (embedding Amiri on its behalf would be the silent substitution the contract
  forbids). Bundled keys still export under their exact `fontKey`. The cache
  index is LRU-capped (`REMOTE_FONT_CACHE_MAX`, 30 faces) and eviction deletes
  the native file too.
- **PNG/thumbnail parity.** Both paths build their provider from
  `loadParagraphFonts` (thumbnails: `renderImportedThumbnail`) or the editor's
  hook provider (`renderProjectToPng` takes it in), so remote faces render in
  PNG exports and gallery thumbnails with no exporter-specific code — parity
  falls out of Phase 2's provider merge.
- **Purge detection and offline catalog** were already delivered in
  Phases 1–2: `isRemoteFontInstalled`/`uriForRemoteFont` verify file existence,
  `listInstalledRemoteFonts` skips purged entries, the missing-font banner
  re-downloads on use, and the catalog JSON is cached (weekly) so search keeps
  working offline after the first fetch.

### Known limit: Latin glyphs in a remote face

Remote faces are downloaded **arabic-only**; Latin text in a remote face
renders with the system fallback (native) or the app's fallback (web). Fetching
`latin` alongside `arabic` is deliberately deferred: each family name holds
**one** registered file in both expo-font and Skia's provider, while Fontsource
serves each subset as a _separate_ true-subset TTF — so a second file cannot
register under the same family, and merging the two into one TTF needs a font
tool this app does not vendor. Nothing else changes: download subsets only
affect `installRemoteFont`'s fetch list, not identity or status.

## 8. Code map

| Concern                                                           | File                                      |
| ----------------------------------------------------------------- | ----------------------------------------- |
| Identity, status machine, URL builder, labels (pure, import-free) | `src/theme/remote-fonts.ts`               |
| Catalogue fetch, cache, search                                    | `src/storage/remote-font-catalog.ts`      |
| Face download + device cache index                                | `src/storage/remote-font-cache.ts`        |
| Registration door + installed snapshot + missing scan             | `src/storage/remote-font-registry.ts`     |
| Installed snapshot hook                                           | `src/hooks/use-installed-remote-fonts.ts` |
| Skia provider merge + rebuild + render resolution                 | `src/editor/skia/text.ts`                 |
| Picker Google Fonts section (search/badge/chips/download)         | `src/editor/font-picker-sheet.tsx`        |
| Missing-font banner on document open                              | `src/editor/EditorScreen.tsx`             |
| Executable spec                                                   | `scripts/check-remote-fonts.mjs`          |
| Contract index                                                    | `docs/index.md` §3/§4                     |
