# Latin script on the canvas - design

> Why a designer can write Latin in a calligraphic face, and the three places
> the editor currently hardcodes Arabic that have to become script-aware
> before it works. This is the behavior contract's companion; when code and this
> document disagree, fix the code.

## 1. Problem

midad is an Arabic calligraphy editor. A designer cannot write Latin in a
calligraphic face, because **every one of the 29 bundled display faces is
Arabic-only**. Latin is reachable today only through two UI sans faces that
already ship for the interface — Cairo and Geist — and through the remote
Google Fonts pipeline, where it is a download.

The obvious framing is "bundle some Latin fonts". That framing is wrong about
where the work is. Adding Latin faces to the registry is the easy half; three
places in the editor assume the text is Arabic, and the first Latin face in the
picker makes all three visible:

| # | Site | Assumption |
| --- | --- | --- |
| 1 | `src/editor/font-picker-sheet.tsx:48` | `SPECIMEN = 'بسم الله'` — one specimen for all 22 families |
| 2 | `src/editor/text/split.ts` | splitting a word into movable per-cluster parts is always safe |
| 3 | `docs/editor-split-and-rejoin.md` §2 | justifies that safety by a **joining** property it never states as a precondition |

Item 1 is cosmetic until a Latin face exists, then every Latin row shows
**Arabic** sample text — and, because the picker renders specimens through
React Native `<Text>` rather than Skia, a face that cannot render the sample
falls back to the platform font rather than failing visibly. The result is not
tofu: it is ten rows of Arabic text in a fallback face, all looking identical,
so the picker tells the designer nothing about the faces it is offering.
Items 2 and 3 are a correctness problem that is **already reachable** — type
Latin in Cairo today and split it, and the result is wrong. They are not caused
by this feature, but this feature is what makes them loud.

### The trap in item 2

The split contract's central argument is:

> the first letter of a connected run is always in **initial** form and the last
> is always in **final** form — which is exactly what HarfBuzz picks when that
> same run is shaped on its own.

That holds for a **connected run**. `src/editor/text/clusters.ts:31` types
Latin as non-joining (`U`), so a Latin cluster is *not* a connected run and the
argument does not apply to it: splitting `hello` per letter severs every
kerning pair, and in a cursive script face — Pinyon Script, Great Vibes, Allura —
it severs the connections that *are* the typeface.

The contract states its justification without stating the precondition, and
`scripts/check-clusters.mjs` goes further: it asserts `Latin has no joining, so
letters split individually` as **correct behaviour**. So the executable spec
defends the very thing that is wrong. A gate change alone would leave the
suite green and the contract still lying.

## 2. Decisions

| # | Decision |
| --- | --- |
| D1 | Scope is Latin calligraphy on the canvas, bundled. No mixed-script work, no UI localization. |
| D2 | One `script: 'arabic' \| 'latin'` tag on `FontFamily` is the single source for all three corrections. |
| D3 | Ten OFL Latin families, ~12 files, into `displayFontAssets` — lazy, so zero added boot cost. |
| D4 | Specimens are per-script, chosen by the family's tag. |
| D5 | The picker sections the bundled list by script, reusing the existing Google Fonts headers. |
| D6 | Splitting a Latin face is refused at the object level. The control stays pressable and explains itself. |
| D7 | Whether the picker warm-up grows by 12 faces or is scoped per section is decided by measurement, not by this document. |
| D8 | The split contract states the joining precondition it has been relying on implicitly, and names Latin as the case that violates it. |

## 3. Scope (D1)

**In:** a designer opens the picker, sees a Latin section, picks a script face,
and writes Latin on the canvas with correct shaping, direction, alignment,
saving, reopening and export.

**Already true, and unchanged by this work:**

- **Direction.** `src/editor/skia/text.ts:300` derives `textDirection` from the
  text — `LTR = 1` when `/[\u0600-\u06FF]/` finds nothing. Pure Latin is already
  LTR. Correct.
- **Shaping.** HarfBuzz via `Skia.ParagraphBuilder` already shapes Latin; the
  engine is script-agnostic.
- **Alignment.** A new text object is created `align: 'center'`
  (`EditorScreen.tsx:1351`), which is script-neutral.
- **Storage, history, export, thumbnails.** All keyed on `fontKey` and `text`,
  neither of which knows about scripts.

**Out of scope:**

- Mixed Arabic + Latin in one text object. Direction is one whole-paragraph
  RTL/LTR guess from a regex, so a mixed run has no base-direction rule. That is
  real bidi work and it is a separate feature.
- UI localization. `src/i18n/strings.ts` already declares
  `Language = 'ar' | 'en'`; the interface is already bilingual.
- Per-letter Latin lettering (§5).

## 4. The schema tag (D2)

```ts
export type FontScript = 'arabic' | 'latin';

export interface FontFamily {
  key: string;
  script: FontScript;   // ← new, required
  // …unchanged
}
```

`script` is **required, not optional.** An optional tag means every consumer
carries a fallback branch, and the failure mode of a forgotten tag is a Latin
family silently defaulting to an Arabic specimen — the exact
silent-wrong-face class the lazy-fonts branch exists to eliminate.

Three behaviours derive from this one field, which is the point: specimen (D4),
picker section (D5) and split refusal (D6) stay consistent because they read the
same fact rather than three parallel lists.

It mirrors something that already exists. Remote families carry
`subsets: string[]` and the picker already surfaces an Arabic badge from
`subsets.includes('arabic')` (`font-picker-sheet.tsx:410`). The concept is
present; only the bundled families lack it.

### The testable seam

The split refusal must be a **pure exported predicate**, not an inline check:

```ts
/** Whether a face's script supports splitting into per-cluster parts. */
export function familySupportsSplit(fontKey: string): boolean;
```

This matters because `scripts/check-fonts.mjs` transpiles
`src/theme/font-families.ts` in memory and destructures its exports (line 35),
so the predicate is directly assertable. A refusal buried inside `split.ts`
would only be testable by source-grep, and `split.ts` cannot be transpiled — it
imports Skia.

Unknown and remote keys resolve to `true`: a remote font declares its own
coverage in `subsets`, and refusing a split on a family we have no script for
would be a regression against today's behaviour.

## 5. Splitting a Latin face (D6, D8)

**Refuse, at the object level.** `splitTextObject` returns a new
`SplitFailure` reason when the source object's family is Latin:

```ts
export type SplitFailure =
  | 'too-few-clusters'
  | 'already-a-part'
  | 'cluster-wrapped'
  | 'layout-failed'
  | 'latin-script';   // ← new
```

**The control stays pressable.** `canSplitSelected` is *not* changed — the
button renders in its normal state and pressing it raises the existing
`splitNotice` snackbar (`EditorScreen.tsx:820-825`) with a new message. A
disabled control tells a sighted user nothing, and a control that vanishes
between selections reads as a glitch.

The cost is one `case` in `splitFailureMessage` (line 788) and one string per
language. The existing refusal machinery is already built and tested.

### Why refuse rather than fix

Three alternatives were considered and rejected:

- **Split per letter, accepting the loss.** Delivers per-letter Latin
  lettering, but silently mangles cursive script faces. This is the failure
  mode this document exists to prevent.
- **Split per word.** Shaping-safe by construction, and a real capability. It
  also redefines what "split" means for one script while the feature is still
  new, and per-letter lettering remains unavailable. Worth revisiting as its own
  feature, once the interaction is understood.
- **Per-letter, ligature-aware** — keep `ffi` together by reading the font's
  own ligature data. The correct long-term answer, and it depends on shaped
  glyph runs being reachable from `SkParagraph` in the React Native Skia
  binding. **That was not verified**, and an unverified platform assumption is
  not a design. If it turns out to be reachable, this decision should be
  revisited.

## 6. The faces (D3)

Ten OFL families, roughly mirroring the Arabic set's range rather than a narrow
slice — a designer picking a Latin face wants a mood, and a picker where every
Latin option is the same mood reads as a bug.

| Family | Mood | Weights |
| --- | --- | --- |
| Pinyon Script | Formal copperplate | 400 |
| Great Vibes | Formal script | 400 |
| Allura | Elegant script | 400 |
| Tangerine | Light formal | 400 |
| Parisienne | Casual script | 400 |
| Yellowtail | Brush script | 400 |
| Sacramento | Brush script | 400 |
| Dancing Script | Casual hand | 400 / 700 |
| Pacifico | Brush | 400 |
| EB Garamond | Old-style serif — the naskh analogue | 400 / 700 |

**This list is a candidate, not a commitment.** Task 1 of the plan verifies
licensing, actual file sizes, and that the source serves static instances, and
the list changes if any of those fail. Fontsource is the likely source, per
`scripts/check-remote-fonts.mjs`.

Two mechanical constraints:

- **Variants are separate keys** (`X` and `X-Bold`), matching the existing
  scheme. `src/editor/skia/text.ts:324` hardcodes `fontStyle: { weight: 400 }`,
  so a bold face *must* be its own registered key.
- **Naming** follows the Geist precedent: `family-latin-400.ttf`.

**They go in `displayFontAssets`, not `coreFontAssets`.** Nothing on the first
screen draws them, so they load on demand. The 8-face core stays 8 — this
feature must not undo the lazy-fonts win.

## 7. Specimens (D4)

`SPECIMEN` becomes a per-script lookup. Arabic families keep `بسم الله`.

For Latin, the specimen should exercise what a script face is *for* — an
ascender, a descender and a ligature opportunity:

```
'بسم الله'      // arabic
'Affection'      // latin — ff ligature, tall f, ct
```

`Affection` is proposed rather than `Lorem ipsum`: the latter is Latin *text*
but says nothing about the hand, and it is what a designer would see in every
other tool.

## 8. Picker sections (D5)

The bundled list is currently a flat `matches.map`. Group it into two
`sectionHead` sections, reusing the styles the Google Fonts section already
uses — no new styling, only grouping and two new header strings.

Both sections respect the active query: `matches` is already a filtered array,
so grouping partitions the filtered result rather than filtering twice. An empty
section renders no header, for the same reason the Google Fonts header hides on
an empty result — a heading above nothing reads as a broken section.

Remote rows are unaffected; they already badge their Arabic coverage.

## 9. Warm-up (D7) — decided by measurement, not here

`warmDisplayFonts()` fires on every picker open so specimens render in their
real face. Ten more families grow that set from 29 to ~41 faces. That works
**against** the lazy-fonts goal, and guessing at the number would be the wrong
instinct.

Two candidates:

- **(a) warm all ~41** — simplest; every specimen correct; slower picker open.
- **(b) warm per section** — Arabic immediately (above the fold), Latin when its
  header scrolls into view. Small complexity, keeps the common case fast. The
  Latin section sits below ~22 Arabic rows and most sessions never reach it.

Plan task 2 measures the picker-open cost on web and picks. If the measurement
is within noise, (a) wins on simplicity.

## 10. Traps and edge cases

- **A Latin face that fails to load** falls back to `'Amiri'`
  (`text.ts:294`). On the canvas that is *worse* than tofu: Amiri has no Latin
  glyphs, so the paragraph renders Latin text through an Arabic face, and the
  design silently ships in the wrong typeface. The ensure-then-open gate from
  `docs/editor-font-loading.md` already covers faces a design *names*, and the
  picker warm-up covers the rest — but the fallback stays silent, and a Latin
  face makes it more reachable.
- **`buildParagraph` keys the family off `registeredFamilies`**, not the family
  table. A Latin key absent from the provider is a silent fallback, not a crash.
- **`filterBundledDuplicates`** compares by folded name and weight coverage. A
  Latin family will not collide with an Arabic one by name, so the dedup is
  unaffected — but a *remote* Latin family that shares a name with a bundled
  one must still be hidden the same way.
- **Font pins** are id-namespaced `family:` vs `google:`. Ten new `family:` ids
  flow through unchanged; `check-font-pins.mjs` must still pass.
- **`requiredDisplayKeys`** is computed from a design's text objects, so a Latin
  face is ensured on open by the same path as an Arabic one.
- **Variable fonts** are not available for static instancing through the current
  toolchain; Dancing Script ships 400/700 as static files.

## 11. Checks and docs

**`scripts/check-fonts.mjs`** (transpiles `font-families.ts`; add the new
predicate to the line-35 destructure):

- every family declares a `script`, and it is one of the two values
- `familySupportsSplit` is true for Arabic and false for Latin, per family
- an unknown key and a remote key both resolve to true
- every Latin family's variants are keys in `displayFontAssets`, none in
  `coreFontAssets`
- the family count moves 22 → 32

**`scripts/check-clusters.mjs`** — the existing `Latin has no joining, so
letters split individually` assertion **stays true**: `segmentClusters` is
unchanged, and Latin still segments per letter. What is new is the refusal at
the object level, asserted in `check-fonts.mjs` against the pure predicate. No
assertion is inverted.

**`docs/editor-split-and-rejoin.md` §2** — state the joining precondition
explicitly, and add the Latin case as the counterexample it is (D8). This is a
correction to a document that is wrong in `main` today, independent of this
feature.

**`docs/editor-font-loading.md`** — the family lists, the new lazy set, and the
warm-up measurement from task 2.

**`docs/index.md`**, **`AGENTS.md`** — wiring, if a new contract section lands.

**`CHANGELOG.md`** — under `[Unreleased]`.

## 12. Testing

There is no test runner. Beyond `node scripts/verify.mjs` (16 tasks):

- **Web, driven.** Seed a project, open the picker, confirm both sections render
  and each row shows its own script's specimen in its real face. Select each
  Latin family, write Latin, confirm it shapes and aligns LTR. Confirm split on
  a Latin object refuses with the explanation and leaves the object intact.
- **Cold boot, measured.** A document naming a Latin face must fetch the 8 core
  faces plus exactly the Latin faces it names — the same invariant the
  lazy-fonts work established for Arabic, now re-measured for Latin.
- **Round trip.** Save, close, reopen: the Latin face reloads behind the cover
  and the editor does not paint until the provider holds it.
- **Export.** A Latin text object exports to SVG with the right face and
  `direction` handling.
- **Not verifiable here.** Android and iOS cold boot, `loadAsync` aliasing for
  the new keys, and native cover duration. This machine has no device, emulator
  or macOS host, so those stay on the manual list — the same debt
  `docs/editor-font-loading.md` already records.

## 13. Code map

| Concern | File |
| --- | --- |
| The `script` tag, the split predicate | `src/theme/font-families.ts` |
| Asset registration | `src/theme/fonts.ts` (`displayFontAssets`) |
| Font files | `assets/fonts/*-latin-*.ttf` |
| Specimens, sections | `src/editor/font-picker-sheet.tsx` |
| Split refusal | `src/editor/text/split.ts` |
| Refusal message | `src/editor/EditorScreen.tsx` (`splitFailureMessage`) |
| Strings | `src/i18n/strings.ts` |
| Warm-up scoping | `src/storage/bundled-font-registry.ts` |
| Contracts | `docs/editor-split-and-rejoin.md`, `docs/editor-font-loading.md` |
| Checks | `scripts/check-fonts.mjs`, `scripts/check-clusters.mjs` |