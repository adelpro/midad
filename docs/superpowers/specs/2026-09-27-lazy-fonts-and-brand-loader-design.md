---
title: Lazy fonts and the brand loader — design
---

# Lazy fonts and the brand loader — design

> **Status:** pending review (2026-09-27) · **Plan:**
> [`../plans/2026-09-27-lazy-fonts.md`](../plans/2026-09-27-lazy-fonts.md)

## 1. Problem

Cold start and “open a design” both pay for the whole calligraphic font set.

`useBootstrap` (`src/hooks/use-bootstrap.ts`) holds the splash until
`useFonts(fontAssets)` resolves, and `fontAssets` (`src/theme/fonts.ts`) is **37
files / 6.26 MB**. Only three families are needed to draw the first screen:

| Group | Files | Size |
| ----- | ----- | ---- |
| Cairo 400/700 (Arabic UI) | 2 | 80 KB |
| Geist 400/500/600/700 (Latin UI) | 4 | 128 KB |
| Amiri 400/700 (display) | 2 | 601 KB |
| **Core subtotal** | **8** | **~0.79 MB** |
| The remaining 30 calligraphic faces | 30 | ~5.47 MB |

The same 5.47 MB is paid a **second time** whenever a typeface provider is built
— on opening a design, and on the gallery’s on-demand import thumbnail:
`loadParagraphFonts` (`src/editor/skia/text.ts`) registers
every bundled face into a Skia provider up front, and `registeredFamilies`
starts as the full bundled key set. Opening a design therefore loads faces the
document may never name, and text can pop in a beat after the canvas.

The visible effect is a long splash and a stalled design open, with nothing on
screen to explain either.

## 2. Decisions

| # | Decision | Value |
| - | -------- | ----- |
| D1 | Split | `fontAssets` splits into `coreFontAssets` (Cairo, Geist, Amiri) and `displayFontAssets` (the 30 calligraphic faces). `fontAssets` stays as their union. |
| D2 | Eager set | Only `coreFontAssets` blocks the splash. |
| D3 | Unloaded-face policy | **Cover, then open.** The document’s bundled faces are loaded before the editor renders, behind the brand loader. Never a silent Amiri. |
| D4 | Mechanism | A session “loaded bundled set” that mirrors `remote-font-registry.ts`, not a second mechanism. |
| D5 | Provider mirror | `useParagraphFonts` publishes the provider **and** the family set it registered as one object, so the cover gate is reactive and can never read a stale mirror. The layout functions keep taking the bare provider. |
| D6 | Picker | Display faces warm in the background on picker open; specimens fill in as faces land. |
| D7 | Loader | A **soft pulse** of the existing brand mark — a gentle scale/opacity “breathing” via Reanimated. No path drawing, no new asset. |
| D8 | Splash handoff | `SplashScreen.setOptions({ fade: true })`; the animated loader is an in-app overlay, never the native splash. |
| D9 | Native embedding (②) | **Deferred.** Embedding core faces via the `expo-font` config plugin helps Android UI text only; it cannot help the Skia canvas, and it breaks the alias model on iOS. |
| D10 | TTF subsetting (③) | **Deferred.** Needs font tooling the repo does not vendor. |

## 3. Registry split (D1)

`src/theme/fonts.ts` declares two objects and keeps the existing one as their
union, so `FontKey`, `font-families.ts`, the SVG exporter, the picker and
`scripts/check-fonts.mjs` keep their current shape:

```ts
export const coreFontAssets = {
  Cairo: require('@/assets/fonts/cairo-arabic-400.ttf'),
  'Cairo-Bold': require('@/assets/fonts/cairo-arabic-700.ttf'),
  Amiri: require('@/assets/fonts/amiri-arabic-400.ttf'),
  'Amiri-Bold': require('@/assets/fonts/amiri-arabic-700.ttf'),
  Geist: require('@/assets/fonts/geist-latin-400.ttf'),
  'Geist-Medium': require('@/assets/fonts/geist-latin-500.ttf'),
  'Geist-SemiBold': require('@/assets/fonts/geist-latin-600.ttf'),
  'Geist-Bold': require('@/assets/fonts/geist-latin-700.ttf'),
} as const;

export const displayFontAssets = {
  /* the other 30 keys, unchanged */
} as const;

export const fontAssets = {
  ...coreFontAssets,
  ...displayFontAssets,
} as const;

export type FontKey = keyof typeof fontAssets;
```

`coreFontAssets` is exactly the set `check-fonts.mjs` already calls `UI_ONLY`,
plus Amiri — the display family every first screen uses through
`fontRoles.display` / `displayBold`.

## 4. The loaded-set registry (D4)

New `src/storage/bundled-font-registry.ts`, deliberately the same shape as
`src/storage/remote-font-registry.ts`:

```ts
/** Load the missing display keys, then publish. No-op when all are loaded. */
export async function ensureBundledFonts(keys: Iterable<string>): Promise<void>;

/** Stable snapshot; a new identity only when its content changes. */
export function getLoadedBundledFontKeys(): ReadonlySet<string>;
export function subscribeLoadedBundledFonts(listener: () => void): () => void;
export function isBundledFontLoaded(key: string): boolean;

/** Every remaining display face — the picker’s warm-up. */
export function warmDisplayFonts(): Promise<void>;
```

- `ensureBundledFonts` filters to keys present in `displayFontAssets` and not yet
  loaded, calls `Font.loadAsync` on that submap (expo-font), then publishes a new
  snapshot and notifies. A key that is not a bundled face is ignored — remote
  keys keep their own registry.
- `coreFontAssets` are treated as loaded from the start; they are gated by
  `useBootstrap` and always present by the time the editor mounts.
- The snapshot is replaced **only** on content change, so a no-op ensure notifies
  nobody — the same rule the remote registry follows.

New `src/hooks/use-loaded-bundled-fonts.ts`, the `useSyncExternalStore` twin of
`use-installed-remote-fonts.ts`:

```ts
export function useLoadedBundledFontKeys(): ReadonlySet<string>;
```

It returns the snapshot directly; there is no mount warm-up, because the initial
set (core) is known synchronously.

`Font.loadAsync` is what makes an alias such as `Gulzar` resolve for RN `<Text>`
as well as `<TextInput>`, so the picker’s specimens and the collection bar’s tile
glyphs use the same registration the canvas uses — not a second mechanism.

## 5. Provider mirror (D5)

`loadParagraphFonts` and `registeredFamilies` change from “every bundled key” to
**`core ∪ loadedBundled ∪ installedRemote`**. The existing rule is preserved: a
family only appears after a provider that actually registered it landed.

The provider reaches React through `setFonts(provider)` while the family mirror
is a module global, so the cover gate would otherwise have to read a mirror that
may belong to a different provider than the one it is holding. Publishing them
together closes that:

```ts
export interface ParagraphFontSet {
  fonts: SkTypefaceFontProvider;
  /** The families the provider actually registered. */
  families: ReadonlySet<string>;
}
```

`useParagraphFonts()` and `loadParagraphFonts()` return `ParagraphFontSet`; the
hook sets the whole object in one `setState`, so `fonts` and `families` can never
disagree.

Only the hook’s **return type** changes. The layout functions (`buildParagraph`,
`layoutArabicText`, `resolveTextWidth`, `textLineBreaks`) and the one-off
renderers (`splitTextObject`, `renderProjectToPng`, `saveProjectThumbnail`) keep
taking the bare provider and keep reading the module mirror. The blast radius is
four files — `skia/text.ts`, `skia/use-text-layouts.ts`, `EditorScreen.tsx`,
`render/thumbnail-on-demand.ts` — not the seven-file signature refactor an
earlier draft proposed.

The fallback stays as-is: a `fontKey` not in the set shapes in Amiri. The module
mirror still reflects the **last-built** provider, which is a pre-existing
behaviour and not made worse here.

## 6. Boot (D1, D2, D8)

`use-bootstrap.ts`:

```ts
const [fontsLoaded, fontError] = useFonts(coreFontAssets);
```

Nothing else about the gate changes. The boot payload drops from 6.26 MB to
~0.79 MB.

`SplashScreen.setOptions({ fade: true })` is added next to
`preventAutoHideAsync()` in `src/app/_layout.tsx`, so the splash cross-fades into
the first route instead of cutting. No loader is shown at boot — the core load is
short enough that a loader would exceed the wait it covers.

## 7. Opening a design — cover, then open (D3)

`EditorScreen`’s project-load effect (`src/editor/EditorScreen.tsx`, ~line 463)
becomes:

1. `const proj = await loadProjectFile(id)`.
2. Compute the document’s bundled faces: every `text` object’s `fontKey` that is
   a key of `displayFontAssets` (remote keys are excluded — the missing-font
   banner already owns those, `docs/editor-remote-fonts.md` §2). This is the same
   scan `missingRemoteFontKeys` performs, restricted to bundled keys.
3. `await ensureBundledFonts(keys)`.
4. `loadProject(proj)`.

Between steps 1 and 4 the brand loader occupies the canvas. The editor renders
its content only once `useParagraphFonts()` has produced a `ParagraphFontSet`
whose `families` contain the document’s faces — which is guaranteed after step 3,
because the snapshot change rebuilds the provider from the loaded set.

`renderImportedThumbnail` (`src/editor/render/thumbnail-on-demand.ts`) gets the
same `ensureBundledFonts` call before `loadParagraphFonts`, so an imported design
whose face has never been loaded still rasterises correctly.

## 8. Font picker (D6)

On sheet open, `warmDisplayFonts()` runs without blocking. The sheet subscribes
to `useLoadedBundledFontKeys()` so specimen rows re-render as faces land, and a
chip tapped before its face is ready uses the spinner state the remote weight
chips already have.

Remote-font behaviour is untouched: the catalogue, badges, download chips, pins
and the missing-font banner all keep working exactly as they do now
(`docs/editor-remote-fonts.md`, `docs/editor-font-pins.md`). The picker’s labels
and search are static data and are unaffected.

## 9. Brand loader (D7, D8)

New `src/components/ui/brand-loader.tsx` — a thin wrapper around the existing
`BrandMark`. No new asset, no path work: one file plus an export.

- **A soft pulse.** An `Animated.View` around `<BrandMark height={…} />` whose
  Reanimated `withRepeat` / `withTiming` loop breathes the mark on scale
  (~`0.98 ↔ 1.03`) and opacity (~`0.75 ↔ 1`) on a ~900 ms cycle. It reads as a
  gentle vibration while data loads, not a progress animation.
- **Reduced motion.** `useReducedMotion()` freezes the mark at rest — no pulse.
- **Theme and RTL.** `BrandMark` already draws in the themed ink color and is
  direction-neutral; nothing to add.
- **Accessibility.** The container carries `accessibilityRole="progressbar"`
  and an `accessibilityLabel` naming the app.
- **Why a pulse, not a draw.** Skia on web needs `LoadSkiaWeb` first (the trap in
  `thumbnail-on-demand.ts`), and a `pathLength`-normalised stroke draw is
  web-only on `react-native-svg`. A scale/opacity pulse needs neither, so it is
  one implementation on web, Android and iOS.

## 10. Traps and edge cases

| Trap | Handling |
| ---- | -------- |
| A gate reads a stale provider | D5: the hook publishes the provider with its family set, so the gate is reactive. |
| A face missing at export or thumbnail time | `renderImportedThumbnail` ensures first; exports are safe because *opening* already ensured the document’s faces. |
| A deep link straight into `/editor/[id]` | Same ensure path — it keys off the loaded project, not navigation history. |
| A document naming a removed or unknown face | Not in `displayFontAssets` → not ensured → shapes in Amiri, exactly today’s behaviour. |
| A document naming a remote face | Not this registry’s concern; the missing-font banner handles it (unchanged). |
| `check-fonts.mjs` parses only `fontAssets` | Extended (see §11): core ∪ display == `fontAssets`; disjoint; core ⊇ the UI-only set; no display key in `fontRoles`. |
| Web has no config-plugin route | `useFonts`/`loadAsync` is already the web path; unchanged. |
| Warming races a selection | Idempotent per key; a key already loaded is a no-op, and the snapshot only changes on real additions. |
| The loader appears for a zero-length wait | The editor only shows it while the project or its fonts are unresolved; a warm open (all faces already loaded) shows it for a frame at most. |

## 11. Checks and docs

- `scripts/check-fonts.mjs` gains assertions on the split: every `fontAssets`
  key is in exactly one of `coreFontAssets` / `displayFontAssets`; the two are
  disjoint; `coreFontAssets` is a superset of the existing `UI_ONLY` set; and no
  `displayFontAssets` key appears as a `fontRoles` value.
- **New** contract `docs/editor-font-loading.md` — the split, the loaded-set
  registry, the cover-then-open policy and the deferred levers.
- `docs/index.md` gains the new contract; `AGENTS.md`’s contract table gains a
  row pointing at `docs/editor-font-loading.md` for `theme/fonts.ts`,
  `storage/bundled-font-registry.ts`, `editor/skia/text.ts` and
  `components/ui/brand-loader.tsx`.

## 12. Testing

No test runner. The split is pinned by the extended `scripts/check-fonts.mjs`;
the wiring is pinned by `tsc --noEmit`, `eslint` and `node scripts/verify.mjs`.
The manual device pass covers:

- Cold start lands on the gallery with no font swap and no Amiri flash.
- Opening an Amiri design is instant; opening a Gulzar design shows the loader,
  then the correct face.
- Opening the picker warms specimens without blocking; a specimen is selectable
  before it finishes warming.
- Importing a `.midad` whose face was never loaded renders the right thumbnail.
- Reduced motion shows the static mark, not the draw.
- Dark mode renders the mark in the themed ink color.
- The remote-font flows (download, missing banner, pins) are unchanged.

## 13. Out of scope

- **② Native embedding** (D9) — Android-only, core-only, and it cannot help the
  Skia canvas.
- **③ TTF subsetting** (D10) — needs font tooling the repo does not vendor.
- Any change to the remote-font feature, the `.midad` format, or the font picker’s
  existing behaviour.
- Merging multi-face families under one name (`FontFamilyDefinition`, SDK 58+).

## 14. Code map

| Concern | File |
| ------- | ---- |
| Core / display split, union preserving `FontKey` | `src/theme/fonts.ts` |
| Loaded-set registry (load, snapshot, warm) | `src/storage/bundled-font-registry.ts` |
| Loaded-set hook | `src/hooks/use-loaded-bundled-fonts.ts` |
| Boot gate on the core set | `src/hooks/use-bootstrap.ts` |
| Splash fade | `src/app/_layout.tsx` |
| `ParagraphFontSet`, provider registration | `src/editor/skia/text.ts` |
| Ensure-then-open, cover gate, loader placement | `src/editor/EditorScreen.tsx` |
| Ensure before import thumbnail | `src/editor/render/thumbnail-on-demand.ts` |
| Picker warm-up + specimen re-render | `src/editor/font-picker-sheet.tsx` |
| Brand loader (soft pulse) | `src/components/ui/brand-loader.tsx` |
| The mark, wrapped unchanged | `src/components/ui/brand-mark.tsx` |
| Executable spec for the split | `scripts/check-fonts.mjs` |
| Contract | `docs/editor-font-loading.md` |
