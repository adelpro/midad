# Latin Script on the Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A designer can pick a Latin calligraphic face from the font picker and write correctly-shaped Latin on the canvas, and the three places the editor hardcodes Arabic become script-aware.

**Architecture:** One required `script: 'arabic' | 'latin'` tag on `FontFamily` is the single source of truth for specimen text, picker sectioning, and whether a split is allowed. The split rule is a *pure exported predicate* in `font-families.ts` — not an inline check in `split.ts` — because `check-fonts.mjs` already transpiles that module in memory and can therefore assert it, whereas `split.ts` imports Skia and cannot be. Ten OFL Latin families join `displayFontAssets` (the lazy half), so the 8-face core and the boot cost are untouched.

**Tech Stack:** Expo SDK 57, React Native, `react-native-skia` (CanvasKit on web), zustand, TypeScript. No test runner — verification is 16 check scripts plus driven web testing.

**Spec:** `docs/superpowers/specs/2026-10-01-latin-script-design.md`

## Global Constraints

- **Read the Expo v57 docs** at `https://docs.expo.dev/versions/v57.0.0/` before writing code. `FontResource` in v57 has no `weight`/`style`; multi-face families and variable fonts are SDK 58+.
- **`src/theme/font-families.ts` must declare only `import type`** — `check-fonts.mjs` transpiles it standalone and a value import breaks it. `src/i18n/strings.ts` declares **no imports at all**.
- **`scripts/check-shortcuts.mjs`, `scripts/check-help.mjs`, and `scripts/check-clusters.mjs` likewise evaluate their subjects standalone.** Do not add value imports to a module one of them transpiles.
- **Formatting is not in the 13 checks.** Use `yarn format:fix`, never `npx prettier@3`. `.prettierrc.json` is the single config — a second `.prettierrc` silently wins the lookup and drops every option.
- **prettier does not read `.gitignore`.** Any new untracked tree must be added to `.prettierignore` or the format task fails.
- **Verify before claiming done:** `node scripts/verify.mjs` must report **16/16**. It is the only gate.
- **A new font file changes the boot contract.** `docs/editor-font-loading.md` §7 records three measured costs; re-measure and update if this work moves them.
- **Every assertion added to a check must be proven to bite** — run it once with the defect reintroduced and confirm RED, then fix and confirm GREEN. An assertion never observed failing proves nothing.
- **Fonts are OFL-licensed.** Verify the license per family before committing its file.

## Review Focus

Five input classes the spec implies but no task's tests exercise. Each is pinned to the task that owns the code.

1. **A design naming a Latin face that fails to load.** `text.ts:294` falls back to `'Amiri'`, which has no Latin glyphs — the paragraph silently renders in the wrong typeface. A designer must never save a design in a face they did not choose. → Task 6.
2. **The UI in Arabic (RTL) must not mirror a Latin text object.** The interface mirrors under `forceRTL`; canvas text must not. A Latin object typed in an Arabic session still reads left-to-right. → Task 5.
3. **A design mixing Arabic and Latin objects.** Both faces must load and both must render; neither may be dropped by the dedup or the ensure pass. → Task 6.
4. **Latin text with no Arabic at all, and Latin text that is only punctuation or digits** (`"2026"`, `"—"`, `"ffi"`). Direction, alignment and shaping must hold with no Arabic codepoint present to anchor them. → Task 5.
5. **A text object whose `text` is empty or whitespace.** It must not crash layout, must not be offered a split, and must not produce a NaN transform. → Task 5.

---

### Task 1: The `script` tag and the split predicate

The foundation. Every later task reads this one field, so it lands first and alone.

**Files:**
- Modify: `src/theme/font-families.ts` — add the type, the field, the predicate
- Modify: `scripts/check-fonts.mjs` — destructure the predicate (line 35) and assert

**Interfaces:**
- Produces: `export type FontScript = 'arabic' | 'latin'`
- Produces: `FontFamily.script: FontScript` (**required**, not optional)
- Produces: `export function familySupportsSplit(fontKey: string): boolean` — `false` only for a known `latin` family; `true` for arabic, unknown, and remote keys

- [ ] **Step 1: Write the failing assertions in `check-fonts.mjs`**

Add `familySupportsSplit` to the destructure at line 35, which currently reads `const { fontFamilies, familyForVariant, variantFor } = moduleShim.exports;`. Then assert:

```js
// every family declares a script, and it is one of the two values
for (const f of fontFamilies) {
  if (f.script !== 'arabic' && f.script !== 'latin') {
    fail(`family ${f.key} declares script ${JSON.stringify(f.script)}`);
  }
}

// split support is per-family, and keyed off the variant's family
const arabicFamily = fontFamilies.find((f) => f.script === 'arabic');
if (!familySupportsSplit(arabicFamily.defaultVariant)) fail('an arabic family refuses split');

// a latin family refuses — none exist yet, so pin the predicate against a probe
if (familySupportsSplit('NotARealFace')) fail('an unknown key must allow split');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/check-fonts.mjs`
Expected: FAIL on `family amiri declares script undefined` — the field does not exist yet.

- [ ] **Step 3: Add the type and field to `font-families.ts`**

```ts
/** The scripts a bundled face can cover. Drives specimen, section and split. */
export type FontScript = 'arabic' | 'latin';
```

Add `script: FontScript;` to the `FontFamily` interface with the comment *"Required, not optional: an absent tag silently falls back to an Arabic specimen."* Then add `script: 'arabic'` to all 22 existing families.

- [ ] **Step 4: Add the predicate**

```ts
/**
 * Whether a face's script supports splitting a word into movable parts.
 *
 * False only for a known Latin family: Latin clusters are not connected runs,
 * so per-cluster splitting severs the ligatures and kerning the typeface is
 * built on. Unknown and remote keys return true — a remote font declares its
 * own coverage in `subsets`, and refusing one we cannot classify would be a
 * regression against today's behaviour.
 */
export function familySupportsSplit(fontKey: string): boolean {
  return familyForVariant(fontKey)?.script !== 'latin';
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `node scripts/check-fonts.mjs` — expect `check-fonts: OK (22 families)`.
Then: `node scripts/verify.mjs` — expect **16/16**.

- [ ] **Step 6: Prove the new assertion bites**

Temporarily change `familySupportsSplit` to `return true;`, run `check-fonts.mjs`, confirm it still passes (correct — no Latin family exists yet, so this assertion is *not* yet load-bearing). Note in the commit body that the Latin assertion becomes load-bearing in Task 3, and do not claim it is proven here.

- [ ] **Step 7: Commit**

```bash
git add src/theme/font-families.ts scripts/check-fonts.mjs
git commit -m "refactor(fonts): tag every family with its script"
```

---

### Task 2: Acquire and register ten Latin families

**Files:**
- Create: `assets/fonts/<family>-latin-<weight>.ttf` × ~12
- Modify: `src/theme/fonts.ts` — add to `displayFontAssets` only
- Modify: `src/theme/font-families.ts` — ten family entries
- Modify: `scripts/check-fonts.mjs` — count and asset assertions

**Interfaces:**
- Consumes: `FontScript`, `FontFamily.script` (Task 1)
- Produces: 10 families with `script: 'latin'`; keys `PinyonScript`, `GreatVibes`, `Allura`, `Tangerine`, `Parisienne`, `Yellowtail`, `Sacramento`, `DancingScript`, `DancingScript-Bold`, `Pacifico`, `EBGaramond`, `EBGaramond-Bold`

- [ ] **Step 1: Download and license-check the files**

Build each URL with the same shape the app already uses for remote faces
(`src/theme/remote-fonts.ts:229`):
`https://cdn.jsdelivr.net/fontsource/fonts/<id>@latest/<subset>-<weight>-normal.ttf`,
with `<id>` the lowercase hyphenated family name (`pinyon-script`, `great-vibes`,
`eb-garamond`), `<subset>` the literal `latin`, and `<weight>` `400` or `700`.
Save to `assets/fonts/<id>-latin-<weight>.ttf`.

Fetch exactly twelve files — the ten singles plus `dancing-script-latin-700.ttf`
and `eb-garamond-latin-700.ttf`. **Dancing Script** and **EB Garamond** ship
variable upstream, so verify each 700 URL resolves to a real static file rather
than a variable instance; if either 404s, drop that family to a single 400
variant and say so in the commit body.

The CDN mirrors `github.com/google/fonts` — the same source the 29 bundled
Arabic faces came from — and every one of these ten is OFL, so the license is
satisfied by sourcing from Fontsource. Confirm the fetch succeeded, then record
the twelve URLs in the commit body.

This is a hand-run step: the repo has **no font-fetch tooling**, and the 38
existing files were placed by hand the same way.

- [ ] **Step 2: Add the failing count assertion**

In `check-fonts.mjs`, assert the family count is 32 and that every `latin` family's variant keys are all in `displayFontAssets` and none in `coreFontAssets`.

Run `node scripts/check-fonts.mjs` — expect FAIL on the count (still 22).

- [ ] **Step 3: Register the assets in `displayFontAssets`**

Add to the lazy object in `src/theme/fonts.ts`. **Never `coreFontAssets`** — nothing on the first screen draws these, and adding them there would undo the boot win this branch exists to deliver.

```ts
PinyonScript: require('@/assets/fonts/pinyon-script-latin-400.ttf'),
GreatVibes: require('@/assets/fonts/great-vibes-latin-400.ttf'),
// …the rest
```

- [ ] **Step 4: Add the ten family entries**

Each with `script: 'latin'`, an Arabic and English label, a style tag naming the Latin mood (not an Arabic one), and its variants. Naming follows the existing camel-case key convention; the file name follows the `family-latin-400.ttf` pattern from Geist.

- [ ] **Step 5: Run it to verify it passes**

`node scripts/check-fonts.mjs` — expect `OK (32 families)`. Then `node scripts/verify.mjs` — expect **16/16**.

- [ ] **Step 6: Prove the assertions bite**

Comment out one `latin` family entry, confirm `check-fonts.mjs` fails, restore it. Then move one Latin key into `coreFontAssets` and confirm the "none in core" assertion fails, restore it.

- [ ] **Step 7: Commit**

```bash
git add assets/fonts src/theme/fonts.ts src/theme/font-families.ts scripts/check-fonts.mjs
git commit -m "feat(fonts): bundle ten Latin calligraphic families"
```

---

### Task 3: Refuse to split a Latin face

**Files:**
- Modify: `src/editor/text/split.ts` — new `SplitFailure` member + the guard
- Modify: `src/editor/EditorScreen.tsx:788` — `splitFailureMessage` case
- Modify: `src/i18n/strings.ts` — the message, both languages
- Modify: `scripts/check-fonts.mjs` — predicate assertions that now bite

**Interfaces:**
- Consumes: `familySupportsSplit` (Task 1)
- Produces: `SplitFailure` gains `| 'latin-script'`
- Produces: `t.editor.splitLatinScript` in both `ar` and `en`

- [ ] **Step 1: Write the failing assertion**

In `check-fonts.mjs`, now load-bearing:

```js
const latinFamily = fontFamilies.find((f) => f.script === 'latin');
if (familySupportsSplit(latinFamily.defaultVariant)) fail('a latin family allows split');
if (!familySupportsSplit(arabicFamily.defaultVariant)) fail('an arabic family refuses split');
```

Run `node scripts/check-fonts.mjs` — expect FAIL (`a latin family allows split`).

- [ ] **Step 2: Add the failure reason and guard in `split.ts`**

Add `'latin-script'` to the `SplitFailure` union. In `splitTextObject`, after the `source.part` check and **before** `segmentClusters`:

```ts
if (!familySupportsSplit(source.fontKey)) {
  return { ok: false, reason: 'latin-script' };
}
```

Import `familySupportsSplit` from `@/theme/font-families`.

- [ ] **Step 3: Add the message**

In `EditorScreen.tsx` `splitFailureMessage`, add `case 'latin-script': return t.editor.splitLatinScript;`. In `strings.ts` add `splitLatinScript` to both language blocks — Arabic and English, describing *why* (the face's letters are joined), not just that it failed.

- [ ] **Step 4: Run it to verify it passes**

`node scripts/check-fonts.mjs` — expect `OK (32 families)`. `node scripts/verify.mjs` — expect **16/16**.

- [ ] **Step 5: Prove the assertion bites**

Temporarily move the `latin-script` guard below the `segmentClusters` call, run `check-fonts.mjs`, confirm it **still passes** (the assertion tests the predicate, not the call site). This is the honest limit of a unit assertion here — say so in the commit body and make the driven check in Task 6 the thing that actually proves the guard fires.

- [ ] **Step 6: Commit**

```bash
git add src/editor/text/split.ts src/editor/EditorScreen.tsx src/i18n/strings.ts scripts/check-fonts.mjs
git commit -m "fix(editor): refuse to split a Latin face"
```

---

### Task 4: Per-script specimens and picker sections

**Files:**
- Modify: `src/editor/font-picker-sheet.tsx:48` — `SPECIMEN` becomes per-script
- Modify: `src/editor/font-picker-sheet.tsx:436` — group `matches` into two sections
- Modify: `src/i18n/strings.ts` — two section titles
- Modify: `scripts/check-fonts.mjs` — specimen and section assertions

**Interfaces:**
- Consumes: `FontFamily.script` (Task 1), the ten Latin families (Task 2)
- Produces: `const SPECIMENS: Record<FontScript, string>` — `{ arabic: 'بسم الله', latin: 'Affection' }`
- Produces: `t.editor.arabicFonts`, `t.editor.latinFonts`

- [ ] **Step 1: Write the failing assertions**

In `check-fonts.mjs`, assert the source no longer contains a single hardcoded `const SPECIMEN = `, and that a `SPECIMENS` record exists keyed by both scripts.

- [ ] **Step 2: Make the specimen per-script**

Replace the constant with a `Record<FontScript, string>` and have `BundledFamilyRow` read `SPECIMENS[family.script]`. `'Affection'` is the Latin specimen: it exercises an `ff` ligature, a tall ascender and a `ct` pair, which `Lorem ipsum` does not.

- [ ] **Step 3: Group the bundled list into two sections**

Partition the already-filtered `matches` by `script` and render a `sectionHead` per non-empty group, reusing the styles the Google Fonts section already uses. Grouping the filtered array rather than filtering twice keeps the search box working across both.

- [ ] **Step 4: Add the two section titles in both languages**

- [ ] **Step 5: Run it to verify it passes**

`node scripts/verify.mjs` — expect **16/16**. `yarn format:fix` for the touched files.

- [ ] **Step 6: Prove the assertions bite**

Hardcode the Arabic specimen back into `BundledFamilyRow`, confirm `check-fonts.mjs` fails, restore.

- [ ] **Step 7: Commit**

```bash
git add src/editor/font-picker-sheet.tsx src/i18n/strings.ts scripts/check-fonts.mjs
git commit -m "feat(editor): give the picker per-script specimens and sections"
```

---

### Task 5: Direction, alignment and the contract correction

The engine already derives direction from the text, so the code work is small. The contract correction is the substance: `docs/editor-split-and-rejoin.md` §2 states a joining-based safety argument **without stating the joining precondition**, and Latin violates it.

**Files:**
- Modify: `docs/editor-split-and-rejoin.md` — state the precondition
- Modify: `scripts/check-clusters.mjs` — keep the existing assertion true, add the Latin note

**Interfaces:**
- Consumes: `familySupportsSplit` (Task 1) — documents *why* it exists
- Produces: no new runtime code

- [ ] **Step 1: Confirm the engine needs no change**

Read `src/editor/skia/text.ts:295-300`. `/[\u0600-\u06FF]/` absent ⇒ `LTR = 1`, which is correct for Latin. **Change nothing here.** Record that this was verified rather than assumed.

- [ ] **Step 2: Add the precondition to the contract**

In §2, state explicitly that the initial/final-form argument holds **only for a connected run**, and add Latin as the named counterexample: `clusters.ts:31` types Latin non-joining, so a Latin cluster is not a connected run and per-cluster splitting severs ligatures and kerning. Cross-reference `familySupportsSplit` and `docs/editor-split-and-rejoin.md`'s own split refusal.

- [ ] **Step 3: Leave the Latin clustering assertion true**

`check-clusters.mjs` asserts `Latin has no joining, so letters split individually`. **This stays true** — `segmentClusters` is unchanged and still segments per letter. Add a comment noting that the refusal lives one layer up in `splitTextObject`, so a future reader does not "fix" the assertion. Do **not** invert it.

- [ ] **Step 4: Verify**

`node scripts/check-clusters.mjs` and `node scripts/verify.mjs` — expect **16/16**.

- [ ] **Step 5: Commit**

```bash
git add docs/editor-split-and-rejoin.md scripts/check-clusters.mjs
git commit -m "docs(split): state the joining precondition Latin violates"
```

---

### Task 6: Measure, verify in the app, and document

The task that decides D7 and proves Review Focus 1–5.

**Files:**
- Modify: `docs/editor-font-loading.md` — the family lists, the warm-up measurement, the re-measured boot costs
- Modify: `docs/index.md`, `AGENTS.md` — wiring if a new section lands
- Modify: `CHANGELOG.md` — `[Unreleased]`
- Modify: `src/storage/bundled-font-registry.ts` — **only if** the measurement says (b)

**Interfaces:**
- Consumes: everything above
- Produces: the recorded warm-up decision and the re-measured boot numbers

- [ ] **Step 1: Measure the warm-up cost**

Open the picker on a cold web build and time it with all 41 faces warmable versus the prior 29. **Record the actual number.** Then apply the decision rule from the spec: under ~300 ms added, keep warming all faces and change no code; over it, scope the Latin set to warm when its section scrolls into view.

- [ ] **Step 2: Measure the cold boot invariant**

A cold `/gallery` must still fetch exactly **8** core files. A document naming Latin faces must fetch the 8 plus exactly the Latin faces it names. This is the lazy-fonts invariant re-measured for Latin — if it fails, the feature has broken the branch's central claim.

- [ ] **Step 3: Verify Review Focus 1 — a Latin face that fails to load**

Seed a design naming a Latin face, force the load to fail, and confirm the editor **does not paint** and the write does not silently land in Amiri. This is the failure class the branch was built to prevent; a Latin face makes `text.ts:294`'s Amiri fallback reachable with no Latin glyphs at all.

- [ ] **Step 4: Verify Review Focus 2 — RTL UI must not mirror Latin canvas text**

Set the interface language to Arabic, write Latin on the canvas, confirm the text still reads left-to-right and is not mirrored by `forceRTL`.

- [ ] **Step 5: Verify Review Focus 3, 4, 5**

A design mixing an Arabic and a Latin object renders both. Latin that is only `"2026"`, `"—"` or `"ffi"` shapes and aligns correctly. An empty or whitespace-only text object does not crash layout, offers no split, and yields no NaN transform.

- [ ] **Step 6: Update the contracts and the changelog**

Family lists in `docs/editor-font-loading.md`, the warm-up decision and its number, the re-measured boot costs. Add a `[Unreleased] / Added` entry describing the Latin faces and the split refusal.

- [ ] **Step 7: Verify and commit**

`node scripts/verify.mjs` — expect **16/16**.

```bash
git add -A
git commit -m "docs: record the Latin faces, the warm-up decision and the boot cost"
```

- [ ] **Step 8: Delete this plan**

Implementation plans for shipped features are deleted once the feature lands; the design spec and the contracts stay. `git rm docs/superpowers/plans/2026-10-01-latin-script.md` as its own commit.