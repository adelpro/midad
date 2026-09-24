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
build/parse round-trip, id and weight normalisers, the face-status state
machine, the CDN URL builder, and that `remote-fonts.ts` declares **no imports**
and never mentions the bundled registry or React Native. It also asserts the
catalogue and cache modules exist and reuse the pure helpers.

## 6. Not yet decided (Phase 2/3)

- The editor wiring: picker search, per-face download state, the Skia provider
  merge, expo-font registration, export embedding.
- LRU eviction beyond a small cap, purge detection on app open.
- Downloading `latin` alongside `arabic` (web renders Latin in a remote face
  with the system fallback until then).
- The `latin`/`arabic` choice affects only which subsets `installRemoteFont`
  fetches — the identity and status machinery above does not change.

## 7. Code map

| Concern                                                   | File                                 |
| --------------------------------------------------------- | ------------------------------------ |
| Identity, status machine, URL builder (pure, import-free) | `src/theme/remote-fonts.ts`          |
| Catalogue fetch, cache, search                            | `src/storage/remote-font-catalog.ts` |
| Face download + device cache index                        | `src/storage/remote-font-cache.ts`   |
| Executable spec                                           | `scripts/check-remote-fonts.mjs`     |
| Contract index                                            | `docs/index.md` §3/§4                |
