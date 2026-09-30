# Editor font loading

> Owns when a bundled face is loaded, who asks for it, and what the user sees
> while they wait: the core/display split, the loaded-set registry, the
> cover-then-open policy, and the loader that covers the wait. Remote Google
> Faces are a separate contract — `docs/editor-remote-fonts.md`. When this
> document and the code disagree, fix the code.

---

## 1. The split, and why those eight

The registry is thirty-seven bundled faces in two halves.

| Set                 | Count | Loaded when                                     |
| ------------------- | ----- | ----------------------------------------------- |
| `coreFontAssets`    | 8     | At boot, gating the splash (`use-bootstrap.ts`) |
| `displayFontAssets` | 29    | On demand, behind the brand loader (§3)         |
| `fontAssets`        | 37    | Never loaded directly — it is their **union**   |

`fontAssets` stays the union so `FontKey`, `font-families.ts`, the picker and
the SVG exporter keep their current shape. Nothing outside this contract reads
it to decide what to load.

**Those eight are the faces the first screen actually draws**, and they are
exactly what `fontRoles` reaches: Cairo 400/700 (the Arabic UI sans), Amiri
400/700 (`display` and `displayBold` in both languages), Geist 400/500/600/700
(the Latin UI sans). A face the first screen cannot show is not worth holding
the splash for: the wait would be real and the benefit invisible.

The split is not a matter of taste. `scripts/check-fonts.mjs` pins it, and the
four assertions that would catch a careless move are:

- the two sets are **disjoint** — a face is eager or lazy, never both;
- `coreFontAssets` contains every `fontRoles` value that is not `monospace`;
- `fontAssets` really spreads the two, rather than shadowing them;
- **no display face appears as a `fontRoles` value.** This is the one that
  matters most: a calligraphic face in a UI role would put a lazy face back on
  the boot path, and the failure is invisible until a cold start renders chrome
  in a face that has not loaded.

## 2. The loaded-set registry

`storage/bundled-font-registry.ts` is the only thing that loads a display face.
It mirrors `remote-font-registry.ts` deliberately — the same shape, the same
rules, one door per set of faces:

- `ensureBundledFonts(keys)` loads the given display faces that are not loaded.
  Idempotent and cheap to call freely: a key already in the snapshot is skipped,
  a key outside `displayFontKeys` (a core face, a remote key, a retired face) is
  ignored, and duplicates collapse — so a document naming Gulzar three times
  loads it once.
- `warmDisplayFonts()` is `ensureBundledFonts(displayFontKeys)`: the font
  picker's background warm-up, so tapping a family is instant.
- `getLoadedBundledFontKeys()` is the synchronous snapshot;
  `useLoadedBundledFontKeys` (through `useSyncExternalStore`) re-renders
  consumers when it changes.

Three rules are load-bearing:

**The snapshot changes only on a real change.** `publish` compares size and
membership before swapping, so warming a set that is already warm notifies
nobody. Without this the picker would re-render on every open and the editor
would rebuild its provider for nothing.

**A failed load leaves the face out.** `ensureBundledFonts` awaits
`loadAsync` _before_ publishing, so a rejection throws with the snapshot
untouched — the same rule the remote registry follows. The snapshot mirrors what
is actually registered, never what was asked for. The next call retries.

**`remote:` never comes through this door.** `displayFontKeys` does not contain
one, so a remote key is filtered out before any load is attempted. Remote faces
have their own registry and their own cache.

## 3. Cover, then open

A design that names Gulzar must not paint one frame in Amiri while Gulzar
loads. The policy is therefore _cover first, then open_:

1. `EditorScreen`'s load effect reads the project, then `await`s
   `ensureBundledFonts` for the display faces that document names —
   **before** `loadProject` puts anything on the canvas.
2. `coverVisible` holds the brand loader (§5) until the Skia provider holds
   **every** required key. `buildParagraph`'s Amiri fallback is the safety net,
   not the normal path.

The gate reads `families.has(key)` off the provider's own family set, so it
cannot lift while a face is still absent. It is keyed on the **content** of the
document's font keys (`projectFontKeySignature`), not the project object — a
drag re-creates the project every frame, and a memo keyed on that identity would
re-derive sixty times a second.

Three consequences that are easy to get wrong:

- **A face missing from the registry falls back to Amiri.** That is the designed
  behaviour when a face genuinely cannot load, and the editor opens rather than
  waiting forever. An `ensureBundledFonts` that rejects stands the gate down
  (`ensureFailed`); without that the cover would stay up for a face that is
  never coming, and `loadProject` would never run.
- **An unknown key is never silently substituted.** A retired or legacy
  `fontKey` is filtered out of the required set by `bundledDisplayKeysFor`, so
  it cannot block the gate — and the missing-font banner does not cover it
  either, because that banner is for remote faces only
  (`docs/editor-remote-fonts.md` §7). Such an object shapes in Amiri. That is a
  legible design, not a crash and not a lie about what the document says.
- **The SVG exporter is unaffected.** It embeds faces straight from `require()`,
  so it never consults the loaded set. Narrowing what Skia registers does not
  narrow what a `.svg` carries.

Imported thumbnails ensure the same way (`render-thumbnail-on-demand.ts`), or
an import would pin its thumbnail to Amiri.

## 4. The provider and its family mirror

`loadParagraphFonts()` registers the **core** faces, the display faces actually
loaded, and every installed remote face — and returns them together:

```ts
interface ParagraphFontSet {
  fonts: SkTypefaceFontProvider; // the provider handle
  families: ReadonlySet<string>; // what it actually registered
}
```

The set travels with the provider because it is the honest answer to "can this
provider draw `fontKey`?" — the question §3's gate asks. Returning a provider
alone would force a caller to consult the module-level `registeredFamilies`
mirror, a _separate_ snapshot that is swapped on every load, and the two could
disagree. `loadParagraphFonts` returns the mirror itself for the same reason:
one object, not two equal ones that can drift.

`registeredFamilies` starts at the **core** keys, not at every bundled key.
Before the first provider existed nothing was registered, so claiming thirty-seven
families only bought a paragraph asking for an absent face and getting Skia's
default — worse than the deliberate Amiri fallback.

`useParagraphFonts` rebuilds when either snapshot changes: the installed remote
set, or the loaded bundled set. That is what lets a face that lands _after_ the
cover lifts still reach the canvas, and it is why the hook takes both.

## 5. The loader

`components/ui/brand-loader.tsx` is a full-bleed paper cover with the brand mark
breathing on a ~900 ms cycle: scale `1.03 ↔ 0.98` and opacity `1 ↔ 0.75`.

**One shared value drives both channels.** They are meant to move as a single
breath; deriving opacity from the scale driver guarantees the same cycle, where
a second `withRepeat` could drift out of phase and read as a stutter.

**Reduce Motion skips the loop entirely** and rests at scale 1 / opacity 1 — not
frozen at an extreme of the cycle.

It is **neither Skia nor an SVG draw**, on purpose. A path-drawing loader would
need Skia, and web needs `LoadSkiaWeb` first — the same trap
`render/thumbnail-on-demand.ts` exists to avoid — and a `pathLength`-normalised
stroke draw is web-only on `react-native-svg`. A transform-and-opacity pulse
needs neither, so it is one implementation on web, Android and iOS. No new
asset, and `brand-mark.tsx` is untouched.

The native splash is a different thing and stays separate: the pulse is an
in-app cover, never the splash (spec D8). The splash only _fades_ into the first
route.

## 6. What SDK 57 allows, and the one place we diverge

The Expo docs at `/versions/v57.0.0/sdk/font` are binding; the unversioned
`/develop/user-interface/fonts` guide is not, because it describes the current
SDK and recommends things that do not exist in 57. Two of its recommendations
are SDK 58+:

- **"Loading several font files under one font family" is SDK 58 and later.**
  SDK 57's `FontResource` has no `weight` and no `style` — so **every weight is
  its own family key** on all three platforms. That is why the registry is keyed
  `Family` / `Family-Bold` rather than one family with two faces.
- **Variable fonts on Android and iOS are SDK 58 and later.** Kufam and ElMessiri
  ship upstream as variable fonts and the editor pins weight 400, so each file's
  default instance is all that is used.

A third rule is why the lazy loader is shaped as it is: _"Declare every face of
a family in one call. A `fontFamily` loads once, so a later `loadAsync` or
`useFonts` call for a name that is already loaded adds no faces to it."_
`ensureBundledFonts` never re-loads a key it holds, and no code relies on a
second call adding faces. Relatedly, `useFonts` does not reload when its map
changes, so lazy loading must go through imperative `loadAsync` — never by
growing the static boot map.

**The divergence:** the docs call the `expo-font` **config plugin** the
recommended method for Android and iOS. We do not use it, for two reasons. It
embeds fonts at build time, which is the bloat this split exists to avoid; and
it changes what a family is called — on iOS the name is the file's PostScript
name, on Android the file name — so the registry would need a per-platform name
map. Expo's own Google-Font example reaches for
`Platform.select({ android: 'Inter_900Black', ios: 'Inter-Black' })`, which the
one-name-per-face model Skia needs cannot absorb. Runtime loading also keeps the
app working in Expo Go, which the plugin does not.

## 7. What this costs, measured

On a real cold page load of the web build, from
`performance.getEntriesByType('resource')`:

| Route                       | Font files fetched                                            |
| --------------------------- | ------------------------------------------------------------- |
| `/gallery` (cold)           | **8** — Cairo ×2, Amiri ×2, Geist ×4. No calligraphic face.   |
| `/editor?id=…` (Gulzar doc) | **10** — the same 8, plus exactly the two the document names. |

Before the split, boot requested all thirty-seven. Two costs remain, both worth
naming rather than discovering:

- **A warm open still shows the cover** — measured 733 ms on web dev, against
  the spec's "a frame at most". The gate keys on the _provider_ being rebuilt,
  and `loadParagraphFonts` re-reads every face it keeps. Lifting the cover
  earlier would reintroduce the silent-Amiri flash the design forbids, so the
  wait is correct and the rebuild is the cost. Fixing it means caching the
  provider across editor mounts, which is a render-contract change.
- **On web a face is fetched twice**, once by expo-font injecting its
  `@font-face` and once by Skia's `Data.fromURI`, plus StrictMode's double
  effect in dev. Collapsing it means `Skia.MatchFont` or a per-family
  `Skia.Data` cache — also a render-contract change.

## 8. Deferred levers

**② Native embedding — deferred.** Embedding the core faces via the config
plugin would only help Android UI text. It cannot help the Skia canvas, which is
where the editor actually draws, and it breaks the alias model on iOS (§6).

**③ TTF subsetting — deferred.** Each shipped face is a full static TTF; a
document typically uses a few words of it. Subsetting needs font tooling the
repo does not vendor, and would change what `require()` returns for every face.

Both are recorded here rather than left implied. Neither is a bug.

## 9. Code map

| Concern                                                   | File                                       |
| --------------------------------------------------------- | ------------------------------------------ |
| Core / display split, `displayFontKeys`, `FontKey`        | `src/theme/fonts.ts`                       |
| Which display faces a document's keys need (pure)         | `src/theme/bundled-fonts.ts`               |
| Loaded-set registry: ensure, warm, snapshot               | `src/storage/bundled-font-registry.ts`     |
| Loaded-set hook                                           | `src/hooks/use-loaded-bundled-fonts.ts`    |
| Boot gate on the core set                                 | `src/hooks/use-bootstrap.ts`               |
| Splash fade                                               | `src/app/_layout.tsx`                      |
| `ParagraphFontSet`, provider registration, Amiri fallback | `src/editor/skia/text.ts`                  |
| Ensure-then-open, cover gate, loader placement            | `src/editor/EditorScreen.tsx`              |
| Ensure before the imported thumbnail                      | `src/editor/render/thumbnail-on-demand.ts` |
| Picker warm-up and specimen re-render                     | `src/editor/font-picker-sheet.tsx`         |
| The loader (soft pulse, reduced motion)                   | `src/components/ui/brand-loader.tsx`       |
| The mark, wrapped unchanged                               | `src/components/ui/brand-mark.tsx`         |
| Executable spec for the split and the scan                | `scripts/check-fonts.mjs`                  |
| Remote faces (the other door)                             | `docs/editor-remote-fonts.md`              |
| Contract index                                            | `docs/index.md` §3                         |
