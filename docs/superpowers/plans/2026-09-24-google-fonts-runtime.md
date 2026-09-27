# Google Fonts at Runtime (Remote Fonts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status: COMPLETE.** Phases 1–3 delivered and committed on `feat/remote-fonts`
> (Phase 1 `67f69b5`, Phase 2 `f0b4409`, Phase 3 — the final commit of this plan).
> `node scripts/verify.mjs` passes 15/15 and the web export build is green. Two
> items are intentionally out of scope and recorded where they live: the
> **latin-subset option** (Phase 3 Step 4) is a known limit — expo-font and Skia
> register **one** face per family name while Fontsource serves each subset as a
> separate true-subset TTF, so a second file cannot share the name without a merge
> tool the app doesn't vendor (`docs/editor-remote-fonts.md` §7) — and the
> interactive pick/download/reopen test on a device or browser plus the iOS
> colon-family-name registration remain manual-test items (Phase 2/3 Verify notes,
> `docs/editor-remote-fonts.md` §6).

**Goal:** Let the user search Google Fonts **by name** in the font picker, download a family on demand, and use it like a bundled family — editor canvas, PNG export, and SVG export — on **native and web**, without a rebuild or new bundled assets.

**Architecture:** One data source for everything — the **Fontsource API** (`api.fontsource.org` + `cdn.jsdelivr.net/fontsource`), which mirrors `github.com/google/fonts` (the same repo this app vendors its bundled faces from), is OFL-1.1, and is CORS-open on every platform (verified live: `ACAO: *`). One catalog call returns `family, subsets (incl. `arabic`), weights, license, version` **and** direct per-subset TTF URLs — no Google CSS-UA tricks, no 2.6MB Google metadata (which has no CORS and can't be fetched from web anyway). Remote faces are identified by a `remote:<id>:<weight>` `fontKey`, resolved by a single `fontFaceForKey()` helper that replaces the scattered `Object.hasOwn(fontAssets, …) ? key : 'Amiri'` fallbacks, with an explicit `remote-missing` state that drives a re-download prompt instead of silent substitution.

**Tech Stack:** React Native / Expo SDK 57, TypeScript, `expo-font` (`Font.loadAsync`, accepts remote/local URIs), Skia 2.6 (`SkTypefaceFontProvider`, `MakeFreeTypeFaceFromData`), `expo-file-system` (new `File`/`Paths` API), zustand + AsyncStorage for the cache index, the repo's platform-split (`*.native.ts`/`*.web.ts`) pattern, standalone `check-*.mjs` scripts (no test runner).

**Spec:** The behavior contract for the font engine is `docs/editor-text-engine.md`; the new remote-font subsystem gets its own contract, `docs/editor-remote-fonts.md`. Bundled-registry invariants live in `scripts/check-fonts.mjs` (must stay green — remote land never touches it).

## Global Constraints

- `src/theme/remote-fonts.ts` (identity + `faceStatusForKey` resolver) declares **no imports at all** (stronger than `import type`-only — the check transpiles it standalone; a value import silently breaks the check). No React Native, no DOM, no `fetch` in this file.
- `src/i18n/strings.ts` must keep **no imports at all**; new strings exist in **both** `ar` and `en`.
- **Never** add remote entries to `font-families.ts` or `fontAssets` — `check-fonts.mjs` hard-gates that every pickable variant is a bundled asset.
- Skia's contract (docs/editor-text-engine.md §4): optional style keys must be **absent, not `undefined`**. §2: provider is mandatory; web CanvasKit is captured at module scope — any web Skia touch stays behind the existing dynamic-import/`WithSkiaWeb` gate.
- `useFonts` does **not** reload when its map changes → use imperative `Font.loadAsync` + rebuild the Skia provider (whose identity change already re-triggers `useTextLayouts`).
- `svg-text.ts` stays import-free; weight is expressed by **which registered name** is used (`skia/text.ts` hard-codes `weight: 400`), so remote weights are separate registered names — matching the bundled `-Bold` key-swap model.
- `LICENSES.md` covers *bundled* faces only; add a one-line note that runtime-downloaded faces are OFL-1.1 Google Fonts fetched from the Fontsource mirror. SVG exports embed downloaded faces — OFL permits redistribution.
- Format with `yarn format:fix` scoped to touched files; no second `.prettierrc`.

## Platform Matrix (all verified live)

| Concern | Native | Web |
|---|---|---|
| Catalog (search by name, `subsets`) | Fontsource API (same as web) | Fontsource API — Google metadata has **no CORS** |
| File download | Fontsource per-subset `.ttf` (CORS `*`) | Same — browser can't do Google's legacy-UA TTF trick, so Fontsource is the uniform path |
| RN `<Text>` | `Font.loadAsync({ key: localFileUri })` | `Font.loadAsync({ key: cachedTtf })` |
| Skia canvas/PNG/thumb | `File.bytes()` → `MakeFreeTypeFaceFromData` | `fetch(cachedTtf)` → `MakeFreeTypeFaceFromData`, behind the CanvasKit gate |
| Cache | `File` in `Paths.cache` + AsyncStorage index | `remote-font-cache.web.ts` (expo-file-system web storage) — repo pattern from `share-temp.*` / `thumbs` |
| SVG export | `collectSvgFontFaces` reads cached bytes (same as bundled) | Same, via fetch of cached bytes |

Default download subset: **arabic** (small files, matches the product). A `latin` option was evaluated in Phase 3 and is **deferred as a known limit** — expo-font and Skia register one face per family name, while Fontsource's per-subset TTFs are separate true subsets, so a second file cannot share the name without a font-merge tool the app doesn't vendor. Recorded in `docs/editor-remote-fonts.md` §7.

## Identity & State

- `fontKey` = `remote:<fontsource-id>:<weight>` (e.g. `remote:markazi-text:400`). Fontsource ids normalize identically on every client, so a `.midad` written on web resolves the same face on native.
- `fontFaceForKey(fontKey): 'bundled' | 'remote-installed' | 'remote-missing' | 'unknown'` — single resolver consulted by `skia/text.ts`, `svg.ts`, the picker.
- `remote-missing` (cached file purged, or document opened on a device that never downloaded it) → **re-download prompt** with Amiri as the visible interim — never silent substitution.

---

## Phase 1 — Foundation (no UI; all checks green)

Build the data layer the other phases stand on. Nothing in the editor changes.

**Files:**
- Add: `src/theme/remote-fonts.ts` — types + `fontKey` format + `fontFaceForKey` resolver (import-type-only).
- Add: `src/storage/remote-font-catalog.ts` — fetch + normalize Fontsource catalog (typed subset of the JSON; `type === 'google'` filter, `subsets` incl. `arabic`, `weights`, `license`, per-subset TTF URL builder).
- Add: `src/storage/remote-font-cache.ts` — **single-file cache using the `Platform.OS` split from `thumbs.ts`** (deviation from the `.native.ts`/`.web.ts` plan: one module, native stores TTF bytes in `Paths.cache`, web keeps no bytes and re-resolves the CORS-open CDN URL + warms the browser HTTP cache). AsyncStorage index `{ [fontKey]: { fontKey, id, weight, subsets, uri, source: 'file'|'url', downloadedAt } }`.
- Add: `scripts/check-remote-fonts.mjs`; wire into `scripts/verify.mjs`.
- Add: `docs/editor-remote-fonts.md`; update `docs/index.md`, AGENTS.md table, `LICENSES.md` note.
- Modify: none of the editor modules.

- [x] **Step 1:** `remote-fonts.ts` — `REMOTE_FONT_KEY_PATTERN` (`^remote:[a-z0-9-]+:[1-9]\d{2}$`, lowercase-only slug), `FaceStatus`, `faceStatusForKey` (pure, takes predicates), `remoteFontKey`/`parseRemoteFontKey`/normalisers, `remoteFontTtfUrl` (jsdelivr CDN builder).
- [x] **Step 2:** `remote-font-catalog.ts` — fetch `https://api.fontsource.org/v1/fonts` (**list endpoint confirmed: ~2100 families**; fields `id, family, subsets, weights, styles, defSubset, variable, category, license, type` — no `version` in the list, so cache entries carry no version), normalize to `RemoteFontFamily[]` (`type === 'google'` filter), weekly AsyncStorage cache, pure `filterRemoteFontFamilies` search.
- [x] **Step 3:** cache (single module, thumbs pattern) — `installRemoteFont` (native: bytes → `Paths.cache` file; web: validate fetch + URL entry), `uriForRemoteFont`, `bytesForRemoteFont`, `isRemoteFontInstalled`, `listInstalledRemoteFonts`, `removeRemoteFont`.
- [x] **Step 4:** `check-remote-fonts.mjs` — fontKey format, resolver state machine, normalisers, CDN URL builder, source purity (zero imports, no RN/`fontAssets` mentions), sibling-module existence + helper reuse.
- [x] **Step 5:** contract doc (`docs/editor-remote-fonts.md`) + `docs/index.md` §3/§4/§7 + AGENTS.md table/check list + `LICENSES.md` note.
- [x] **Verify:** `node scripts/verify.mjs` — 15/15 pass (12 checks + typecheck + lint + format).

## Phase 2 — Editor integration (user-visible core)

**Files:**
- Modify: `src/editor/skia/text.ts` — provider merges installed remote faces (read cache URIs alongside `fontAssets`); expose a rebuild trigger.
- Modify: `src/editor/font-picker-sheet.tsx` — new **"بحث Google Fonts"** section: search → rows with **✓ يدعم العربية / بدون دعم عربي** badge → pick family → weight chips (from catalog `weights`) → download+register on tap.
- Modify: `src/editor/EditorScreen.tsx` — open-document scan for `remote-missing` keys → banner "تحميل الخطوط المفقودة" → on-demand download → provider rebuild; `fontFaceForKey` replaces any `<Text>` fallback of the removed kind.
- Modify: `src/i18n/strings.ts` — search, download states, missing-font banner, license line (ar + en).
- Modify: `src/storage/project-schema.ts` — doc comment: `fontKey` may be `remote:<id>:<weight>`.

- [x] **Step 1:** provider merge + rebuild hook (`skia/text.ts`); existing `useTextLayouts` memo dep picks it up.
- [x] **Step 2:** picker section: search, arabic badge, weight chips, per-row download state machine (`idle → downloading → installed → error(إعادة)`).
- [x] **Step 3:** registration path — downloaded face → `Font.loadAsync({ fontKey: localUri })` **and** provider rebuild (single module owns both, so they can't drift).
- [x] **Step 4:** missing-font banner on open + schema doc comment + i18n strings.
- [x] **Verify:** `node scripts/verify.mjs` — 15/15 pass. Web export (Metro production bundle + static routes) also passes. **Deferred manual items:** interactive pick/download/reopen on a device and in a live browser session — no desktop browser is attached to this environment; iOS colon-family-name registration is unverified (risk + test item recorded in `docs/editor-remote-fonts.md` §6).

## Phase 3 — Exports + hardening

**Files:**
- Modify: `src/editor/export/svg.ts` — `familyForKey` / `collectSvgFontFaces` resolve remote faces (mostly done by the resolver; verify `@font-face` family name = `Family Weight`, read cached bytes).
- Modify: renderers as needed — PNG/thumbnails render remote faces once the provider has them (verify).
- Modify: `remote-font-cache.*` — LRU eviction cap (~30 faces), purge-detection re-download, offline/retry states.
- Options: fetch `latin` alongside `arabic`; Variant chip parity with bundled families' `عادي/عريض` labels.

- [x] **Step 1:** SVG export embeds a downloaded face — `familyForKey` resolves a
  remote key to a `Family Weight` @font-face name (`Markazi Text 400`),
  `collectSvgFontFaces` inlines the installed TTF bytes (`bytesForRemoteFont`:
  native `File.bytes()` / web re-fetch of the cached CDN URL), and `textToSvg`
  single-quotes non-identifier family names so the `<text font-family>` matches
  the rule. A missing face is left unembedded — the viewer substitutes, never a
  different embedded face. `check-fonts.mjs` pins the quoting. Round-trip is
  covered by `verify` + the web export build; interactive export on a device or
  live browser remains a manual item.
- [x] **Step 2:** PNG/thumbnail parity — confirmed by code, no renderer change
  needed: thumbnails (`renderImportedThumbnail`) build from `loadParagraphFonts`
  and PNG export (`renderProjectToPng` in `EditorScreen`) takes the editor's hook
  provider, both of which already merge installed remote faces (Phase 2).
- [x] **Step 3:** eviction + purge + offline catalog — `remote-font-cache.ts`
  trims the index LRU-style at `REMOTE_FONT_CACHE_MAX` (30 faces, deleting native
  files too); purge detection (file-existence checks, `listInstalledRemoteFonts`
  skips purged entries, banner re-downloads on use) and the weekly offline
  catalog copy were already delivered in Phases 1–2.
- [x] **Step 4:** picker polish — weight chips label 400 → `عادي`/`Regular` and
  700 → `عريض`/`Bold` (new `fontWeightRegular`/`fontWeightBold` strings, ar+en
  both), and `useInstalledRemoteFontKeys` warms the installed snapshot from the
  cache on first use so faces installed in a previous launch show `✓` from the
  first frame. The **latin-subset option** is deferred as a known limit (status
  block above; `docs/editor-remote-fonts.md` §7).
- [x] **Verify:** `node scripts/verify.mjs` — 15/15 pass; `expo export --platform
  web` production bundle + 13 static routes builds. Interactive export of a
  remote-font project on a device and in a live browser, plus the iOS
  colon-family-name registration, remain deferred manual items (no device or
  browser attached to this environment).

## Review Focus (failure modes, most likely first)

1. **fontKey format drift** → resolver never matches a stored key; doc/check script pins the regex. (P1 Step 1/4.)
2. **expo-font and Skia provider drift** → picker specimen shows the face, canvas falls back; one module owns both registrations. (P2 Step 3.)
3. **Silent Amiri instead of `remote-missing`** → the old `Object.hasOwn` fallback must be *replaced*, not left beside the resolver, or missing fonts mask as bundled. (P2 Step 4.)
4. **Cache purge → registered-to-vanished-file** → `Font.loadAsync` fails or PDFs/PNG embed empty; verify file existence before register, re-download on miss. (P2 Step 3 / P3 Step 3.)
5. **Web arabic-only subset** → Latin glyphs in a remote face fall back to the system font on web while native renders them; document + optional `latin` flag. (P3 Step 4.)
6. **Web Skia built outside the CanvasKit gate** → module-eval crash; keep provider builds behind the dynamic-import shape. (P2 Step 1.)
7. **`check-fonts.mjs` broken by remote land** → never add remote entries to `font-families.ts`/`fontAssets`; run `verify` each phase. (All.)