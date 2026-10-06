# Editor font loading

> Owns when a bundled face is loaded, who asks for it, and what the user sees
> while they wait: the core/display split, the loaded-set registry, the
> cover-then-open policy, and the loader that covers the wait. Remote Google
> Faces are a separate contract — `docs/editor-remote-fonts.md`. When this
> document and the code disagree, fix the code.

---

## 1. The split, and why those eight

The registry is forty-nine bundled faces in two halves.

| Set                 | Count | Loaded when                                           |
| ------------------- | ----- | ----------------------------------------------------- |
| `coreFontAssets`    | 8     | At boot, gating the launch cover (`use-bootstrap.ts`) |
| `displayFontAssets` | 41    | On demand, behind the brand loader (§3)               |
| `fontAssets`        | 49    | Never loaded directly — it is their **union**         |

The lazy half is twenty-nine Arabic calligraphic faces plus twenty Latin ones
(§1.1). `fontAssets` stays the union so `FontKey`, `font-families.ts`, the picker
and the SVG exporter keep their current shape. Nothing outside this contract
reads it to decide what to load.

**Those eight are the faces the first screen actually draws**, and they are
exactly what `fontRoles` reaches: Cairo 400/700 (the Arabic UI sans), Amiri
400/700 (`display` and `displayBold` in both languages), Geist 400/500/600/700
(the Latin UI sans). A face the first screen cannot show is not worth holding the
**launch cover** for — the splash's own job ends at theme hydration (§5), and the
cover is what stands between the user and a first route that would paint a wrong
face: the wait would be real and the benefit invisible.

The split is not a matter of taste. `scripts/check-fonts.mjs` pins it, and the
assertions that would catch a careless move are:

- the two sets are **disjoint** — a face is eager or lazy, never both;
- `coreFontAssets` contains every `fontRoles` value that is not `monospace`;
- `fontAssets` really spreads the two, rather than shadowing them;
- **no display face appears as a `fontRoles` value.** This is the one that
  matters most: a calligraphic face in a UI role would put a lazy face back on
  the boot path, and the failure is invisible until a cold start renders chrome
  in a face that has not loaded.
- `coreFontAssets` has **exactly eight** entries. The four above are necessary
  but not sufficient — nothing else would notice a face _added_ to the core,
  which is a boot-cost regression that is invisible on a warm start. Pinning the
  count is what makes adding one require a deliberate argument.
- every family tagged `script: 'latin'` has all its variants in
  `displayFontAssets` and **none** in `coreFontAssets`.

### 1.1 The Latin faces

Ten OFL families, twelve files, from the Fontsource CDN — the same source the
Arabic display faces came from (`github.com/google/fonts`). They span a mood
range rather than a slice of one: Pinyon Script, Great Vibes, Allura, Tangerine,
Parisienne, Yellowtail, Sacramento, Dancing Script (400/700), Pacifico and
EB Garamond (400/700). 632 KB total, 35–91 KB per file.

They are **display-only**, and that is the whole reason this feature costs nothing
at cold boot. Nothing on the first screen draws a Latin face, so all twelve load
on demand exactly like their Arabic counterparts.

`FontFamily.script` (`'arabic' | 'latin'`, **required**) is what makes them
script-aware rather than merely present. One tag drives three behaviours, which
is the point of deriving them from a single fact:

- the picker shows a **Latin specimen** (`Affection`) and groups the list into
  Arabic and Latin sections;
- `familySupportsSplit` **refuses** to split a word in one of them, because a
  Latin cluster is not a connected run — see `docs/editor-split-and-rejoin.md` §2;
- the split refusal surfaces through the existing `splitNotice`, with the
  control left pressable so it can explain itself.

The tag is required rather than optional on purpose. An absent tag would fall
back to the Arabic specimen, which is the silent-wrong-face class this whole
contract exists to prevent, and a compile error is the only cheap way to catch
it.

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

**A key already loading is awaited, not skipped.** There are three legitimate
callers — the editor's open path, §3's requirement effect, and the picker's
warm-up — and the last two can name a face the first already has in flight.
`inFlight` maps each in-flight key to the promise of the batch loading it, and a
second caller awaits that batch instead of issuing a competing `loadAsync`.
Skipping it would be worse than either: the cover gate opens the design on the
strength of its `ensure` resolving, so a resolved-but-still-absent face puts the
silent Amiri flash straight back.

**`remote:` never comes through this door.** `displayFontKeys` does not contain
one, so a remote key is filtered out before any load is attempted. Remote faces
have their own registry and their own cache.

## 3. Cover, then open

A design that names Gulzar must not paint one frame in Amiri while Gulzar
loads. The policy is therefore _cover first, then open_:

1. `EditorScreen`'s load effect reads the project, then `await`s
   `ensureBundledFonts` for the display faces that document names —
   **before** `loadProject` puts anything on the canvas.
2. A second effect, keyed on the requirement itself, ensures **any** display key
   the document comes to name — the picker applying a face, a split, a paste, an
   undo (§3.1).
3. `coverVisible` holds the brand loader (§5) until the Skia provider holds
   **every** required key. `buildParagraph`'s Amiri fallback is the safety net,
   not the normal path.

The same cover is the **launch** cover (§5): the root layout renders it while the
core faces are still loading, so the wait before the first route is the same mark
breathing rather than the native splash's still frame.

The gate reads `families.has(key)` off the provider's own family set, so it
cannot lift while a face is still absent. It is keyed on the **content** of the
document's font keys (`projectFontKeySignature`), not the project object — a
drag re-creates the project every frame, and a memo keyed on that identity would
re-derive sixty times a second. That string is also what keeps §3.1's effect from
running per frame: the required keys are derived from it, so their identity only
moves when the document's font keys actually change.

### 3.1 Whoever names a face owns loading it

The open path only covers the design being _opened_. A display key can also
_arrive_, and the gate reacts to any key in the document — so with only the open
path, picking a calligraphic face in the picker closed the gate on a face
nothing was loading. If the picker's warm-up happened to be in flight, the cover
came up for seconds on the most ordinary editing action; if that warm-up had
rejected, nothing ever retried it and the cover **pinned**, with no way back —
the loader replaces the whole editor, and the back button lives below it.

The fix is an effect keyed on `[id, requiredDisplayKeys]` that ensures the
requirement. One owner, every path that can put a key into a document.

`ensureFailed` is **per requirement, not per mount**: the effect clears it before
ensuring, so one unrecoverable face does not stand the gate down for every face
the rest of the session names, and each new design retries. It is set on
rejection, and stands the gate down rather than stranding.

**The provider build needs the same stand-down, and did not have one.** That is
the defect this section also records. `loadParagraphFonts` fetches every face
through `Skia.Data.fromURI` — on a device in dev, an HTTP read from the dev server
— and when one of those reads fails, the promise it returns **never settles**:
react-native-skia's Android loader has Java return `null` from
`getJniStreamFromSource` and its C++ thread early-return without calling the
resolve callback (`JniPlatformContext.cpp`, `performStreamOperation`), so there is
no rejection to catch and nothing to retry. The build stayed pending, `skiaFonts`
stayed null, and a null provider reads as **keep covering** — so a momentary blip
between emulator and host (observed: `SocketException: Software caused connection
abort` across several `PlatformContext.getStreamAsBytes` reads, with the
dev-server reachability check failing in the same instant) pinned the loader over
the whole editor, back button included, until the route was re-entered. The
effect's triggers are the two snapshots, so a failed build moved neither and
nothing ever re-ran it.

The lesson is the shape of the guard, not just its existence: **a hung build cannot
be caught, so it has to be bounded.** A rejected build is retried; a build that
passes `PARAGRAPH_FONT_BUILD_TIMEOUT_MS` (6 s — several times what a healthy build
takes here) is abandoned and retried; and once the attempts are spent
(`PARAGRAPH_FONT_BUILD_ATTEMPTS`) the hook reports `failed`, on which `fontsReady`
stands down exactly as it does on `ensureFailed`. A failed attempt publishes
nothing, so the mirror keeps describing the provider already on screen and a later
build can still replace it. This is **not** dev-only: any build that hangs strands
the same way in a release build. `scripts/check-fonts.mjs` pins all five halves —
the catch, the retry, the timeout, the recorded failure, and the gate's use of it.

Four consequences that are easy to get wrong:

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

Imported thumbnails ensure the same way (`render/thumbnail-on-demand.ts`), or
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
mirror, a _separate_ snapshot, and the two could disagree.

### 4.1 Only the caller that keeps a build publishes the mirror

`loadParagraphFonts` **returns** its set; it does not install it. The write is
`publishParagraphFonts`, and its only two callers are the ones that decide to keep
a build: `useParagraphFonts` (under its `active` guard, immediately before
`setParagraphFonts`) and the one-off import thumbnail.

This is not ceremony. The hook has two rebuild triggers — the remote snapshot and
the bundled snapshot — and both fire during an ordinary open: the remote refresh
publishes on mount, then the ensure publishes. Two builds are therefore in flight,
they complete out of order, and the slower one is precisely the one whose state
update was discarded. If that discarded build could still write the mirror, the
mirror would end up describing a build nobody renders with while §3's gate —
reading the _accepted_ set — reported the face ready. The cover would lift, and
every paragraph in that face would fall back to Amiri: silently, permanently, and
saved that way.

So the rule is narrow and deliberate: **the mirror and the state must move
together, under one guard.** `scripts/check-fonts.mjs` pins both halves — that
`loadParagraphFonts` does not assign the mirror, and that every file calling
`loadParagraphFonts` also publishes.

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

**Reduce Motion skips the loop entirely.** The driver is the scale itself, so the
resting value is 1: scale 1, opacity 0.85. That is the _interior_ of the cycle,
not either extreme — freezing it at `SCALE_HI` would present a zoomed-in logo as
the resting state, which reads as a rendering fault.

It is **neither Skia nor an SVG draw**, on purpose. A path-drawing loader would
need Skia, and web needs `LoadSkiaWeb` first — the same trap
`render/thumbnail-on-demand.ts` exists to avoid — and a `pathLength`-normalised
stroke draw is web-only on `react-native-svg`. A transform-and-opacity pulse
needs neither, so it is one implementation on web, Android and iOS. No new
asset, and `brand-mark.tsx` is untouched.

The loader is also the **launch cover** (0.5.0, superseding the earlier
"never the launch path" note).
`useBootstrap` hides the native splash the moment the persisted settings hydrate —
hydration is what decides the theme, so the cover can be painted in the right
colour from that point — and `app/_layout.tsx` renders `BrandLoader` at
`height={144}` while `hydrated && !ready && !error`, over a `Stack` that mounts on
the same `ready || error` transition. The cover is at most a few frames on a warm start, it
cannot strand the app (it unmounts exactly when the routes mount), and it adds no
latency because nothing is deferred to it. The 144 dp matches the splash's visible
logo (`imageWidth` 200 × the asset's 0.72 crop), so the mark does not change size
at the handoff.

The native splash is a different thing and stays separate: the pulse is an
in-app cover, never the splash. Its own job now ends at theme hydration rather
than at font load, so the pulse is the thing holding the longer wait. The splash
still only _fades_ into the first route, and only on iOS — `fade` is annotated
`@platform ios` in expo-splash-screen's own types, and Android hides the splash
with its own window animation, so `setOptions` is gated on `Platform.OS === 'ios'`
rather than implying an arrival only one platform gets. The dark splash gets its
own light mark (`assets/images/splash-icon-dark.png`, `dark.image`), because the
brand mark's `#05060A` is invisible on the `#111111` dark background.

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

The batch is settled **per face**, not as one unit. `ensureBundledFonts` loads
each missing key on its own and publishes every key that resolves before it
rethrows the first rejection. That ordering matters because the picker's warm-up
asks for all forty-one faces in one call: if a single face failed and the batch
published only as a unit, no row would repaint and every specimen would sit on
its fallback — a failure on an unloadable face would be visible on faces that are
perfectly fine. The rethrow is preserved because the editor's cover gate awaits
this promise and must not open a design whose own face is missing (task §3).

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

Before the split, boot requested all thirty-seven. Three costs remain, all worth
naming rather than discovering:

- **A warm open still shows the cover** — measured 733 ms on web dev, against
  the spec's "a frame at most". The gate keys on the _provider_ being rebuilt,
  and `loadParagraphFonts` re-reads every face it keeps. Lifting the cover
  earlier would reintroduce the silent-Amiri flash the design forbids, so the
  wait is correct and the rebuild is the cost. Fixing it means caching the
  provider across editor mounts, which is a render-contract change.
- **A cold open builds the provider twice, serially.** The ensure publishes its
  faces, which retriggers the hook mid-load, so the build that opened the design
  is superseded by one that includes them. That is §4.1's race made benign by
  the publish guard — and the same cache would collapse the two into one.
- **On web a face is fetched twice**, once by expo-font injecting its
  `@font-face` and once by Skia's `Data.fromURI`, plus StrictMode's double
  effect in dev. Collapsing it means `Skia.MatchFont` or a per-family
  `Skia.Data` cache — also a render-contract change.

None of the three was measured on a release build or on a device; the numbers
above are web dev, which is the only platform reachable here (see §9).

### 7.1 The picker's warm-up, with the Latin set

`warmDisplayFonts()` loads **every** display face on each picker open, so its
specimen can render in the real face. The Latin set grew that from 29 files to
41, which works against the goal of §1, and the right response was to measure it
rather than to guess — see the design's decision D7, which deliberately left
this open.

| Candidate                | Cost                                                              |
| ------------------------ | ----------------------------------------------------------------- |
| **(a) warm all 41**      | every specimen correct; picker open pays for faces below the fold |
| **(b) warm per section** | Arabic immediate; Latin only when its header scrolls into view    |

(b) is the more attractive shape on paper — the Latin section sits below 22
Arabic rows, and most sessions never reach it — but it costs real complexity in
the one path that decides what a document may draw, and complexity in the
loading path is exactly what §3 exists to prevent. So the decision rule was
fixed in advance rather than chosen after seeing a number: under ~300 ms of
added warm time, keep warming everything and change no code. The measurement
and the outcome are recorded in §7.2.

### 7.2 The measurement, and why it did not decide it

Measured on an Android 16 x86_64 emulator (Pixel 9 Pro AVD, **software** GPU),
debug build against Metro. Each sample cleared the app's data first, so
`loadAsync` read every file off the APK with no on-disk font cache to serve it. Metro's own bundling was warmed
beforehand and no bundle was built during a sample.

| Sample | 29 Arabic | all 41  | added   |
| ------ | --------- | ------- | ------- |
| 1      | 7544 ms   | 8211 ms | 667 ms  |
| 2      | 6384 ms   | 9699 ms | 3315 ms |
| 3      | 7690 ms   | 7918 ms | 228 ms  |

Medians give **667 ms** added, comfortably over the line. The per-pair spread of
228–3315 ms is the real result: the same code on the same machine produced a 5×
spread in the derived difference.

The spread has a cause, and it is not the font loading. Reloads taken during the
same session landed in two other regimes entirely — `all 41` at **929 / 1161 /
1225 ms** with the OS page cache warm and a real parse, and the 29 Arabic faces
at **1–4 ms** once expo-font's own on-disk cache existed. So the absolute figure
for one unchanged code path moves by roughly **8×** on nothing but cache state,
which is why the derived difference wanders.

It is also the wrong scale. 7.5 s to load 29 faces is not a phone; it is a
debug build on a software rasteriser, inflated by a factor nobody has measured.
Scaling 667 ms down by whatever that factor turns out to be could put the answer
under 300 ms or leave it above — **the data cannot adjudicate the threshold in
either direction**, and reporting either verdict as the measurement would be
inventing it.

**So (a) stands and no code changes.** Not because 667 ms is acceptable — it was
never shown to be — but because the pre-fixed rule asks for a measurement this
environment cannot make, and §3's whole argument is against adding machinery to
the loading path without evidence. Refusing to split would be acting on noise.
The status quo is also the only option here that is _reversible by doing
nothing_, which is the right bias when the evidence is absent.

Outstanding: the same three-sample run on a physical device with a release
build. If it lands over 300 ms, (b) becomes the answer and this section is the
record of the number that changed the mind.

## 8. Deferred levers

**② Native embedding — deferred.** Embedding the core faces via the config
plugin would only help Android UI text. It cannot help the Skia canvas, which is
where the editor actually draws, and it breaks the alias model on iOS (§6).

**③ TTF subsetting — deferred.** Each shipped face is a full static TTF; a
document typically uses a few words of it. Subsetting needs font tooling the
repo does not vendor, and would change what `require()` returns for every face.

Both are recorded here rather than left implied. Neither is a bug.

## 9. Code map

| Concern                                                              | File                                       |
| -------------------------------------------------------------------- | ------------------------------------------ |
| Core / display split, `displayFontKeys`, `FontKey`                   | `src/theme/fonts.ts`                       |
| Which display faces a document's keys need (pure)                    | `src/theme/bundled-fonts.ts`               |
| Loaded-set registry: ensure, warm, snapshot                          | `src/storage/bundled-font-registry.ts`     |
| Loaded-set hook                                                      | `src/hooks/use-loaded-bundled-fonts.ts`    |
| Boot gate on the core set                                            | `src/hooks/use-bootstrap.ts`               |
| Splash fade                                                          | `src/app/_layout.tsx`                      |
| `ParagraphFontSet`, provider registration, Amiri fallback            | `src/editor/skia/text.ts`                  |
| Ensure-then-open, cover gate, loader placement                       | `src/editor/EditorScreen.tsx`              |
| Ensure before the imported thumbnail                                 | `src/editor/render/thumbnail-on-demand.ts` |
| Picker warm-up and specimen re-render                                | `src/editor/font-picker-sheet.tsx`         |
| The loader (soft pulse, reduced motion)                              | `src/components/ui/brand-loader.tsx`       |
| The mark, wrapped unchanged                                          | `src/components/ui/brand-mark.tsx`         |
| Executable spec for the split, the scan, and the publish/ensure pins | `scripts/check-fonts.mjs`                  |
| Remote faces (the other door)                                        | `docs/editor-remote-fonts.md`              |
| Contract index                                                       | `docs/index.md` §3                         |
