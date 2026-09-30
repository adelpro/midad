# Lazy fonts and the brand loader — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop loading 5.47 MB of calligraphic fonts before the first screen and before every design open, and cover what is left of the wait with a gently pulsing brand mark.

**Architecture:** Split the bundled font registry into a small eager core and a lazy display set. A session “loaded bundled set” registry — mirroring `remote-font-registry.ts` — loads display faces on demand and publishes a snapshot; the Skia provider registers `core ∪ loaded ∪ remote`. Opening a design ensures the document’s faces behind the loader before the editor renders.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-font, expo-splash-screen, expo-router, @shopify/react-native-skia, react-native-reanimated, react-native-svg, TypeScript, zustand.

**Spec:** `docs/superpowers/specs/2026-09-27-lazy-fonts-and-brand-loader-design.md`

## Global Constraints

- Expo SDK 57 only: `useFonts` supports one alias family per key. Do **not** use `FontFamilyDefinition` / `fontDefinitions` arrays (SDK 58+).
- No new dependencies. The loader is a Reanimated scale/opacity pulse around the existing `BrandMark`.
- **Never** Skia in the loader — Skia on web requires `LoadSkiaWeb` first (see `src/editor/render/thumbnail-on-demand.ts`). No SVG animation either: `react-native-svg` honours `pathLength` on web only, so a stroke-draw would silently break on Android and iOS.
- `fontAssets` stays the union of core and display; `FontKey` and `font-families.ts` keep their current shape.
- Any module a `scripts/*.mjs` check transpiles standalone must declare **only `import type`** or no imports at all: `src/theme/bundled-fonts.ts` has no imports.
- `expo-splash-screen`’s `setOptions` is a no-op on web (verified in `build/SplashScreen.js`), so the fade call needs no platform guard.
- Keep the diff small: the layout/render functions keep taking the bare `SkTypefaceFontProvider`. Only the hook’s return type changes in Task 4.
- No second prettier config: `.prettierrc.json` is the only one. Use `yarn format:fix`, never `npx prettier@3`.
- Commits use conventional commits (commitlint is enforced by husky). One commit per task.
- `node scripts/verify.mjs` is the gate for every task that touches code.

## Review Focus

- A **document naming several different display faces** at once — all of them must be loaded, not just the first. Owning task: Task 5 (loader opens the design with every face correct); Task 2 pins the multi-key scan.
- An **unknown or legacy fontKey** (a face removed from the registry) — must fall back to Amiri and must never throw. Owning task: Task 5, with the ignore-unknown case pinned in Task 2.
- A **remote face** stored in the document — must be left to the missing-font banner and never treated as a bundled display key. Owning task: Task 2 (pure scan), Task 5 (wiring).
- **Cold start deep-linked straight into `/editor/[id]`** — the cover must not strand the screen, and the document’s faces must still be ensured. Owning task: Task 5.
- **Reduced motion, dark mode, and a warm re-open** (every face already loaded) — the loader must not pulse under reduced motion, must render in themed ink, and must not linger a frame longer than the wait. Owning task: Task 3 (component), Task 5 (cover).

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `src/theme/fonts.ts` | Core/display split; `fontAssets` union; `displayFontKeys` set. |
| `src/theme/bundled-fonts.ts` | **New.** Pure, import-free: pick a document’s bundled display keys. |
| `src/storage/bundled-font-registry.ts` | **New.** Load display faces, publish the loaded set. |
| `src/hooks/use-loaded-bundled-fonts.ts` | **New.** `useSyncExternalStore` view of the loaded set. |
| `src/components/ui/brand-loader.tsx` | **New.** Pulsing brand mark cover. |
| `src/editor/skia/text.ts` | `ParagraphFontSet`; registration = core ∪ loaded ∪ remote. |
| `src/editor/skia/use-text-layouts.ts` | Uses the hook’s new shape. |
| `src/editor/EditorScreen.tsx` | Ensure-then-open; cover gate. |
| `src/editor/render/thumbnail-on-demand.ts` | Ensures faces before rendering. |
| `src/editor/font-picker-sheet.tsx` | Warm-up on open; specimen re-render. |
| `src/hooks/use-bootstrap.ts` | Boots on the core set. |
| `src/app/_layout.tsx` | Splash fade. |
| `scripts/check-fonts.mjs` | Pins the split, the pure scan, and the registry shape. |
| `docs/editor-font-loading.md` | **New.** The contract. |

---

### Task 1: Split the font registry

**Files:**
- Modify: `src/theme/fonts.ts`
- Modify: `scripts/check-fonts.mjs`

**Interfaces:**
- Produces: `coreFontAssets`, `displayFontAssets`, `fontAssets` (the union, unchanged `FontKey`), and `displayFontKeys: ReadonlySet<string>`.

- [ ] **Step 1: Write the failing check**

In `scripts/check-fonts.mjs`, replace the single `fontAssetKeys(source)` helper with `assetKeysOf(source, objectName)` (slice from the object’s declaration to the next `\n} as const;`, then match `^\s{2}'?([A-Za-z-]+)'?:\s*require\(`).

Then, **after** the existing `UI_ONLY` declaration and **before** the family loop (the block reads `UI_ONLY`, which is a `const` and would throw in the temporal dead zone if hoisted above it), add:

```js
const coreKeys = assetKeysOf(fontsSource, 'coreFontAssets');
const displayKeys = assetKeysOf(fontsSource, 'displayFontAssets');
if (coreKeys.size === 0) fail('coreFontAssets has no entries');
if (displayKeys.size === 0) fail('displayFontAssets has no entries');
for (const key of coreKeys) {
  if (displayKeys.has(key)) fail(`${key} is in both coreFontAssets and displayFontAssets`);
}
if (!coreKeys.has('Cairo') || !coreKeys.has('Amiri')) {
  fail('coreFontAssets must contain Cairo and Amiri');
}
for (const key of UI_ONLY) {
  if (!coreKeys.has(key)) fail(`UI font ${key} is not in coreFontAssets`);
}
if (!/fontAssets\s*=\s*\{[^}]*\.\.\.coreFontAssets[^}]*\.\.\.displayFontAssets/s.test(fontsSource)) {
  fail('fontAssets must spread coreFontAssets and displayFontAssets');
}
const rolesBlock = fontsSource.slice(fontsSource.indexOf('fontRoles'));
for (const key of displayKeys) {
  if (new RegExp(`[:\\s]'?${key}'?[,;}]`).test(rolesBlock)) {
    fail(`display face ${key} is used as a UI font role`);
  }
}
const assets = new Set([...coreKeys, ...displayKeys]);
```

Then keep the existing family and orphan loops, driven from `assets` instead of the old extraction.

- [ ] **Step 2: Run the check to verify it fails**

Run: `node scripts/check-fonts.mjs`
Expected: FAIL — `coreFontAssets has no entries` (and the zero-keys failure, since `fontAssets` no longer holds `require()` calls).

- [ ] **Step 3: Implement the split in `src/theme/fonts.ts`**

Move the eight core entries (Cairo 400/700, Amiri 400/700, Geist 400/500/600/700) into `coreFontAssets`, the other thirty into `displayFontAssets`, and declare:

```ts
export const fontAssets = { ...coreFontAssets, ...displayFontAssets } as const;
export const displayFontKeys: ReadonlySet<string> = new Set(Object.keys(displayFontAssets));
```

Update the file’s doc comment to explain the split and why those eight are core.

- [ ] **Step 4: Run the check to verify it passes**

Run: `node scripts/check-fonts.mjs`
Expected: `check-fonts: OK (22 families)`. (The family count is unchanged by the
split — `fontAssets` stays the union of the two sets.)

- [ ] **Step 5: Verify the whole suite and that boot is unchanged**

Confirm `src/hooks/use-bootstrap.ts` still calls `useFonts(fontAssets)` (Task 6 flips it) — this task changes no behaviour.

Run: `node scripts/verify.mjs`
Expected: every task passes.

- [ ] **Step 6: Commit**

```bash
git add src/theme/fonts.ts scripts/check-fonts.mjs
git commit -m "refactor(fonts): split the registry into core and display assets"
```

---

### Task 2: The loaded-set registry

**Files:**
- Create: `src/theme/bundled-fonts.ts`
- Create: `src/storage/bundled-font-registry.ts`
- Create: `src/hooks/use-loaded-bundled-fonts.ts`
- Modify: `scripts/check-fonts.mjs`

**Interfaces:**
- Consumes: `displayFontAssets`, `displayFontKeys` (Task 1).
- Produces:
  - `bundledDisplayKeysFor(fontKeys: Iterable<string>, displayKeys: ReadonlySet<string>): string[]`
  - `ensureBundledFonts(keys: Iterable<string>): Promise<void>`
  - `getLoadedBundledFontKeys(): ReadonlySet<string>`
  - `subscribeLoadedBundledFonts(listener: () => void): () => void`
  - `isBundledFontLoaded(key: string): boolean`
  - `warmDisplayFonts(): Promise<void>`
  - `useLoadedBundledFontKeys(): ReadonlySet<string>`

- [ ] **Step 1: Write the failing test for the pure scan**

Append to `scripts/check-fonts.mjs` a transpile-and-evaluate block for `src/theme/bundled-fonts.ts` (mirroring the `font-families.ts` block):

```js
const bundledSource = readFileSync(join(here, '..', 'src', 'theme', 'bundled-fonts.ts'), 'utf8');
if (/^\s*import\s+(?!type\b)/m.test(bundledSource)) {
  fail('src/theme/bundled-fonts.ts must declare no value imports');
}
const { outputText: bOut } = ts.transpileModule(bundledSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const bShim = { exports: {} };
new Function('exports', 'module', bOut)(bShim.exports, bShim);
const { bundledDisplayKeysFor } = bShim.exports;
const display = new Set(['Gulzar', 'Marhey', 'Amiri-Bold']);
const scan = bundledDisplayKeysFor(
  ['Gulzar', 'Gulzar', 'remote:markazi-text:400', 'Nope', 'Amiri', 'Marhey'],
  display,
);
if (JSON.stringify([...scan].sort()) !== JSON.stringify(['Gulzar', 'Marhey'])) {
  fail(`bundledDisplayKeysFor = ${JSON.stringify(scan)}`);
}
```

This pins three Review Focus cases at once: several faces all survive, unknown keys are dropped, remote keys are ignored, and results are de-duplicated.

- [ ] **Step 2: Run the check to verify it fails**

Run: `node scripts/check-fonts.mjs`
Expected: FAIL — cannot read `src/theme/bundled-fonts.ts`.

- [ ] **Step 3: Create `src/theme/bundled-fonts.ts`**

Pure, no imports:

```ts
/**
 * The bundled display faces a set of stored font keys needs, de-duplicated.
 * Keys that are not bundled display faces — remote keys, unknown or removed
 * faces, and the always-loaded core — are ignored.
 */
export function bundledDisplayKeysFor(
  fontKeys: Iterable<string>,
  displayKeys: ReadonlySet<string>,
): string[] {
  const out = new Set<string>();
  for (const key of fontKeys) {
    if (displayKeys.has(key)) out.add(key);
  }
  return [...out];
}
```

- [ ] **Step 4: Run the check to verify it passes**

Run: `node scripts/check-fonts.mjs`
Expected: `check-fonts: OK`.

- [ ] **Step 5: Create `src/storage/bundled-font-registry.ts`**

Mirror `src/storage/remote-font-registry.ts`’s snapshot discipline:
- `const loaded = new Set<string>()`; `let snapshot: ReadonlySet<string> = new Set()`.
- `ensureBundledFonts(keys)` filters `keys` to `displayFontKeys` entries not in `loaded`, returns early when empty, else `await Font.loadAsync(Object.fromEntries(missing.map((k) => [k, displayFontAssets[k as keyof typeof displayFontAssets]])))`, adds them to `loaded`, replaces `snapshot` with `new Set(loaded)`, and notifies listeners.
- `warmDisplayFonts()` is `ensureBundledFonts(displayFontKeys)`.
- `isBundledFontLoaded(key)` is `loaded.has(key)`.
- A comment must state that a face whose `loadAsync` rejects is left out (the `await` throws before the snapshot is replaced), matching the remote registry’s “snapshot mirrors what is actually registered” rule.

- [ ] **Step 6: Create `src/hooks/use-loaded-bundled-fonts.ts`**

`useSyncExternalStore(subscribeLoadedBundledFonts, getLoadedBundledFontKeys, getLoadedBundledFontKeys)`. No mount warm-up (the initial set is known synchronously).

- [ ] **Step 7: Pin the registry shape in the check**

Add source assertions to `scripts/check-fonts.mjs`:
- `src/storage/bundled-font-registry.ts` exists, contains `displayFontAssets` and `Font.loadAsync`, and does not inline an alias-key map (no `'[A-Za-z-]+': require`).
- `src/hooks/use-loaded-bundled-fonts.ts` exists and uses `useSyncExternalStore`.

- [ ] **Step 8: Verify**

Run: `node scripts/check-fonts.mjs`
Expected: `check-fonts: OK`.

Run: `node scripts/verify.mjs`
Expected: every task passes.

- [ ] **Step 9: Commit**

```bash
git add src/theme/bundled-fonts.ts src/storage/bundled-font-registry.ts src/hooks/use-loaded-bundled-fonts.ts scripts/check-fonts.mjs
git commit -m "feat(fonts): add the bundled display-face registry"
```

---

### Task 3: BrandLoader — the soft pulse

**Files:**
- Create: `src/components/ui/brand-loader.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Consumes: `BrandMark` from `./brand-mark` (unchanged).
- Produces: `export function BrandLoader(props: BrandLoaderProps)` and `export interface BrandLoaderProps { height?: number; label?: string }`.

- [ ] **Step 1: Write `src/components/ui/brand-loader.tsx`**

Requirements:
- A full-bleed container (`flex: 1`, `alignItems`/`justifyContent` centred) filled with `useTheme().colors.paper`, so it can serve as a loading cover anywhere.
- Inside, an `Animated.View` wrapping `<BrandMark height={height} />` (`height` defaults to 96).
- A Reanimated loop: `withRepeat(withSequence(withTiming(1.03, {duration: 450}), withTiming(0.98, {duration: 450})), -1, true)` driving scale, and an opacity loop between `0.75` and `1` on the same cycle. Together they read as a gentle vibration.
- `useReducedMotion()` short-circuits to a static mark at rest.
- The container carries `accessibilityRole="progressbar"` and `accessibilityLabel={label}` (`label` defaults to the app name).
- No Skia, no `react-native-svg` animation, no `pathLength`.

- [ ] **Step 2: Export it from `src/components/ui/index.ts`**

```ts
export { BrandLoader } from './brand-loader';
export type { BrandLoaderProps } from './brand-loader';
```

- [ ] **Step 3: Verify it compiles and lints**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/components/ui/brand-loader.tsx --cache --cache-location .eslintcache`
Expected: no errors.

- [ ] **Step 4: Verify it visually (manual, Android + web)**

Temporarily render `<BrandLoader />` as the first child of the gallery screen (`src/app/(tabs)/gallery.tsx`), then revert the temporary mount.

Run: `yarn android`
Expected: the mark pulses softly, centred on the themed paper background, and covers the screen.

Run: `yarn web`
Expected: the same pulse in a browser.

Expected after revert: `git status` shows only this task’s files.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/brand-loader.tsx src/components/ui/index.ts
git commit -m "feat(ui): add the pulsing brand loader"
```

---

### Task 4: Publish the provider with its family mirror

**Files:**
- Modify: `src/editor/skia/text.ts`
- Modify: `src/editor/skia/use-text-layouts.ts`
- Modify: `src/editor/EditorScreen.tsx`
- Modify: `src/editor/render/thumbnail-on-demand.ts`

**Interfaces:**
- Produces:
  - `export interface ParagraphFontSet { fonts: SkTypefaceFontProvider; families: ReadonlySet<string> }`
  - `loadParagraphFonts(): Promise<ParagraphFontSet>`
  - `useParagraphFonts(): ParagraphFontSet | null`

**Behaviour is unchanged in this task.** `loadParagraphFonts` still registers **every** `fontAssets` key; Task 5 narrows it. The layout and render functions keep their current signatures — only the hook’s return type changes.

- [ ] **Step 1: Change `text.ts`**

- Add `ParagraphFontSet`.
- `loadParagraphFonts` collects the registered names into a local `Set` and returns `{ fonts: provider, families: added }` instead of the bare provider. Keep the module-level `registeredFamilies` swap exactly as it is.
- `useParagraphFonts` holds `useState<ParagraphFontSet | null>(null)` and sets the whole object in one call.

- [ ] **Step 2: Update the three call sites**

- `use-text-layouts.ts`: the memo uses `set.fonts` and depends on the set’s identity.
- `EditorScreen.tsx`: pass `skiaFonts?.fonts ?? null` where a provider is expected (the export and split calls); keep the local name `skiaFonts`.
- `thumbnail-on-demand.ts`: dispose via `set.fonts.dispose()`.

- [ ] **Step 3: Verify no behaviour changed**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `node scripts/verify.mjs`
Expected: every task passes.

Run: `yarn android`
Expected (manual): open an Amiri design and a Gulzar design; text renders in the correct face in both, exactly as before. Export a PNG and an SVG; both still contain the text face.

- [ ] **Step 4: Commit**

```bash
git add src/editor/skia/text.ts src/editor/skia/use-text-layouts.ts src/editor/EditorScreen.tsx src/editor/render/thumbnail-on-demand.ts
git commit -m "refactor(editor): publish the paragraph provider with its family set"
```

---

### Task 5: Lazy registration and ensure-then-open

**Files:**
- Modify: `src/editor/skia/text.ts`
- Modify: `src/editor/EditorScreen.tsx`
- Modify: `src/editor/render/thumbnail-on-demand.ts`
- Modify: `src/editor/font-picker-sheet.tsx`

**Interfaces:**
- Consumes: `ensureBundledFonts`, `useLoadedBundledFontKeys`, `bundledDisplayKeysFor`, `displayFontKeys` (Tasks 1–2); `ParagraphFontSet` (Task 4); `BrandLoader` (Task 3).
- Produces: the shipped behaviour — boot and open no longer load the display set.

This is the atomic behaviour flip. All four sites land together; the app is incorrect if any is missing.

- [ ] **Step 1: Narrow the Skia registration in `text.ts`**

`loadParagraphFonts` registers:
- every `coreFontAssets` entry,
- every `displayFontAssets` entry whose key is in `getLoadedBundledFontKeys()`, and
- every installed remote face (unchanged).

`useParagraphFonts` adds `useLoadedBundledFontKeys()` to its effect dependencies so a newly loaded face rebuilds the provider.

- [ ] **Step 2: Ensure before rendering an imported thumbnail**

In `thumbnail-on-demand.ts`, before `loadParagraphFonts()`:

```ts
const { ensureBundledFonts } = await import('@/storage/bundled-font-registry');
const { bundledDisplayKeysFor } = await import('@/theme/bundled-fonts');
const { displayFontKeys } = await import('@/theme');
await ensureBundledFonts(
  bundledDisplayKeysFor(projectFontKeys(project), displayFontKeys),
);
```

`projectFontKeys` returns every `text` object’s `fontKey` (`project.objects` where `type === 'text'`).

- [ ] **Step 3: Cover-then-open in `EditorScreen`**

- Add `const [projectLoading, setProjectLoading] = useState(false)`.
- In the load effect, when `id` exists: `setProjectLoading(true)`, `const proj = await loadProjectFile(id)`, then — only when `proj` is non-null — `await ensureBundledFonts(bundledDisplayKeysFor(<proj text fontKeys>, displayFontKeys))`, then `loadProject(proj)`, and `setProjectLoading(false)` in a `finally`. If `proj` is null, skip the ensure and still clear the flag.
- Derive readiness:

```ts
const requiredDisplayKeys = useMemo(
  () => bundledDisplayKeysFor(<live text fontKeys>, displayFontKeys),
  [<live text fontKeys>],
);
const fontsReady =
  skiaFonts != null && requiredDisplayKeys.every((k) => skiaFonts.families.has(k));
const coverVisible = !!id && (projectLoading || !fontsReady);
```

- When `coverVisible`, return `<BrandLoader />` before the editor JSX, after all hooks.
- The `requiredDisplayKeys` memo must key on the *content* of the document’s font keys, not the project object identity, so a drag (which recreates the object every frame) does not re-run it — the same trick the missing-font banner uses.

- [ ] **Step 4: Warm display faces when the picker opens**

In `font-picker-sheet.tsx`:
- Call `warmDisplayFonts()` in an effect keyed on `visible` (fire-and-forget; a rejection must not crash the sheet).
- Subscribe with `useLoadedBundledFontKeys()` so the sheet re-renders as faces arrive.

- [ ] **Step 5: Verify the Review Focus cases**

Run: `npx tsc --noEmit` and `node scripts/verify.mjs`
Expected: pass.

Run: `yarn android`
Expected (manual):
- Open an Amiri design: no cover, instant.
- Open a Gulzar design (never opened since launch): cover pulses → correct face, no Amiri flash.
- Open a document naming **three** different display faces: all three correct, never one right and the rest in Amiri.
- Open a document with an unknown/legacy `fontKey`: opens, that object shapes in Amiri, no crash.
- Open a document containing a `remote:` face: the missing-font banner behaves as before.
- Deep-link straight to `/editor/[id]` on cold start: the cover appears and clears; the screen is never stranded.
- Re-open a design already opened this session: the cover is at most a frame.
- Open the picker: specimens fill in as faces load, and selecting a not-yet-warmed calligraphic face still applies it correctly.

- [ ] **Step 6: Commit**

```bash
git add src/editor/skia/text.ts src/editor/EditorScreen.tsx src/editor/render/thumbnail-on-demand.ts src/editor/font-picker-sheet.tsx
git commit -m "feat(editor): load a design's faces on demand behind the brand loader"
```

---

### Task 6: Boot on the core set and fade the splash

**Files:**
- Modify: `src/hooks/use-bootstrap.ts`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Consumes: `coreFontAssets` (Task 1). Requires Task 5 already shipped so display faces are ensured on open.

- [ ] **Step 1: Boot on the core set**

In `use-bootstrap.ts`, `useFonts(coreFontAssets)` in place of `useFonts(fontAssets)`. Update the hook’s comment to state that the display set is loaded on demand (Task 5) and that only the faces the first screen uses gate the splash.

- [ ] **Step 2: Fade the splash into the first route**

In `src/app/_layout.tsx`, next to `SplashScreen.preventAutoHideAsync()`:

```ts
SplashScreen.setOptions({ fade: true, duration: 200 });
```

- [ ] **Step 3: Verify cold start on Android**

Run: `node scripts/verify.mjs`
Expected: pass.

Run: `yarn android`
Expected (manual): cold start reaches the gallery with no Amiri/Geist swap and no flash of a fallback face; Arabic UI is Cairo, Latin UI is Geist, headings are Amiri. Then open a calligraphic design and confirm it still lands correctly. Confirm the splash fades rather than cuts.

- [ ] **Step 4: Verify the web build**

Run: `yarn build:check` (`expo export --platform web`)
Expected: succeeds — this catches a lazy-load change that breaks the static export or the web `@font-face` path.

Run: `yarn web`
Expected (manual): cold start is fast, the gallery renders in Cairo/Geist/Amiri, and opening a calligraphic design shows the loader then the correct face. The network panel should show no calligraphic `.ttf` request on first paint — on web the lazy faces are not even fetched until used.

- [ ] **Step 5: Verify iOS**

Not reachable from this Windows machine. Record it as a required pre-release check and run it on a Mac or an iOS simulator build before shipping: the same cold start, design open, and loader checks as Step 3, plus confirming the aliased family names (`Cairo-Bold`, `Geist-SemiBold`, `Amiri-Bold`) still resolve — this plan deliberately keeps the SDK 57 runtime-loading path on iOS so they do.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-bootstrap.ts src/app/_layout.tsx
git commit -m "perf(app): boot on the core font set and fade the splash"
```

---

### Task 7: The contract document

**Files:**
- Create: `docs/editor-font-loading.md`
- Modify: `docs/index.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: the shipped behaviour from Tasks 1–6.

- [ ] **Step 1: Write `docs/editor-font-loading.md`**

Follow the house contract style (`docs/editor-remote-fonts.md` is the model): a purpose line, then sections covering
- the core/display split and why those eight are core;
- the loaded-set registry, its snapshot-only-on-change rule, and that a failed `loadAsync` leaves a face out;
- the cover-then-open policy, including that a face missing from the registry falls back to Amiri and an unknown key is never silently substituted;
- the provider/family-mirror pairing and why the hook returns both;
- the loader’s pulse and its reduced-motion behaviour, and why it is neither Skia nor an SVG draw;
- the two deferred levers (native embedding, subsetting) and why;
- a code map table.

End with the same “when this document and the code disagree, fix the code” line the other contracts use.

- [ ] **Step 2: Index and table**

Add the contract to `docs/index.md`’s contract list, and add a row to `AGENTS.md`’s contract table pointing at `docs/editor-font-loading.md` for `theme/fonts.ts`, `storage/bundled-font-registry.ts`, `editor/skia/text.ts` and `components/ui/brand-loader.tsx`.

- [ ] **Step 3: Verify formatting and the full suite**

Run: `yarn format:fix`
Expected: only the touched files are rewritten (if at all).

Run: `node scripts/verify.mjs`
Expected: every task passes, including the format check.

- [ ] **Step 4: Commit**

```bash
git add docs/editor-font-loading.md docs/index.md AGENTS.md
git commit -m "docs: add the font-loading contract"
```

---

## Self-Review Notes

- **Spec coverage:** §3 → Task 1. §4 → Tasks 1–2. §5 → Task 4. §6 → Task 6. §7 → Task 5. §8 → Task 5 Step 4. §9 → Task 3. §11 → Tasks 1, 2, 7.
- **Type consistency:** `ParagraphFontSet` is produced in Task 4 and consumed in Tasks 4–5; `bundledDisplayKeysFor` and `ensureBundledFonts` are produced in Task 2 and consumed in Task 5. No task introduces a name another task spells differently.
- **Ordering constraint:** Tasks 4 → 5 → 6 must ship in that order. Task 4 must keep registering every face, or Task 5’s ensure is not yet in place and designs would flash Amiri.
- **Simplification applied:** the loader is a scale/opacity pulse (no SVG draw, no path length, no `brand-mark.tsx` change), and the provider work touches four files instead of seven because the layout/render signatures are left alone.
- **Deferred by design:** native embedding (②) and TTF subsetting (③) are recorded in the spec and the contract, not built here.
