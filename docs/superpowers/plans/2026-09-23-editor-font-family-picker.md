# Editor Font Family Picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the editor's flat font list with a family → variant picker over a new 13-family, all-OFL Arabic set, and fix the latent SVG bold-export bug it exposes.

**Architecture:** A pure, import-free registry (`src/theme/font-families.ts`) defines families and their variant `fontKey`s; `fontAssets` in `fonts.ts` stays the flat asset map, so Skia and PNG need no change. The SVG exporter stops collapsing a variant to its base family and embeds the exact file. The Text sheet swaps its button wrap for a specimen grid + inline variant chips.

**Tech Stack:** React Native 0.86.3 / Expo SDK 57, TypeScript, the repo's `Button`, `useTheme`, `useT`, `spacing`/`radius`/`typeScale`/`fontRoles` tokens. No test runner — verification is `node scripts/verify.mjs` plus a new `scripts/check-fonts.mjs` and the manual device checks written into each task.

**Spec:** `docs/superpowers/specs/2026-09-23-editor-font-family-picker-design.md`

## Global Constraints

- **`font-families.ts` declares no value imports.** It may use `import type` only. The check script transpiles and evaluates it standalone (`new Function`); a value import breaks it silently — the same trap documented for `shortcuts.ts`, `help/catalog.ts` and `i18n/strings.ts`.
- **`fontAssets` keys are the contract.** Every `fontKey` written by the picker must exist in `fontAssets`; the canvas (`skia/text.ts`) and PNG (`render/offscreen.ts`) select the face by that key and need no other change.
- **All new faces must be SIL OFL.** Record the source URL and license in the task's commit message body.
- **Every new asset is a static TTF.** No variable fonts; the renderer drives no `fvar` axis.
- **Retiring `calligraphyFonts` must not invalidate a stored `fontKey`.** `Cairo` stays in `fontAssets`; only the picker drops it.
- **`src/editor/export/svg.ts` must keep the "unembeddable family is silently skipped" behaviour** (`docs/editor-render-contract.md:181-186`).
- **Update `scripts/verify.mjs`'s header count and `AGENTS.md` in the same commit that adds `check-fonts.mjs`.**
- **Run `node scripts/verify.mjs` before every commit.** It is the repo's single "is this tree OK?" command.

## Review Focus

The five failure modes the spec implies but no task's tests exercise. Each line names the input and the behavior a reasonable person expects; the task that owns the code gets the test.

1. **A project saved with a `fontKey` that the picker no longer lists (`Cairo`, or a retired face).** Expect it to still render on canvas, in PNG and in SVG — never a blank or a crash.
2. **A single-variant family selected.** Expect no variant chip row and no Bold preset — not an inert chip or a silent no-op.
3. **Toggle Bold via the Style preset, then reopen the Text sheet.** Expect the variant chip to already show Bold, i.e. the two controls agree.
4. **Tap "Classic" after a Bold variant was chosen.** Expect the family's declared default variant, not merely "strip `-Bold`" (which fails for any key whose default is not the plain suffix base).
5. **Export an SVG for a bold text object.** Expect the embedded `@font-face` to be the bold file, so the glyphs are actually bold in the viewer.

---

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/theme/font-families.ts` | Create | Pure registry: `FontFamily`, `FontVariant`, `fontFamilies`, lookups |
| `src/theme/fonts.ts` | Modify | Add 8 `fontAssets` entries; re-export registry |
| `src/theme/index.ts` | Modify | Export the registry types/functions; drop `calligraphyFonts` |
| `src/editor/export/svg.ts` | Modify | Embed the exact variant instead of the base family |
| `src/editor/font-picker.tsx` | Create | Family grid + variant chips (Layout A) |
| `src/editor/EditorScreen.tsx` | Modify | Use `FontPicker`; derive labels from the registry |
| `src/theme/presentations.ts` | Modify | Bold shortcut + Classic default via the registry |
| `src/i18n/strings.ts` | Modify | `editor.fontFamily`, `editor.variant` copy |
| `scripts/check-fonts.mjs` | Create | Pin the registry invariants |
| `scripts/verify.mjs`, `AGENTS.md` | Modify | Register the new check; update the count |
| `docs/editor-render-contract.md` | Modify | Per-variant `@font-face` wording |
| `assets/fonts/*.ttf` | Create | 8 new TTFs |

---

### Task 1: Vendor the new faces and extend `fontAssets`

**Files:**
- Create: `assets/fonts/lateef-arabic-400.ttf`, `lateef-arabic-700.ttf`, `rakkas-arabic-400.ttf`, `qahiri-arabic-400.ttf`, `katibeh-arabic-400.ttf`, `jomhuria-arabic-400.ttf`, `vibes-arabic-400.ttf`, `amiri-quran-arabic-400.ttf`
- Modify: `src/theme/fonts.ts` (`fontAssets`)

**Interfaces:**
- Produces: `fontAssets` keys `Lateef`, `Lateef-Bold`, `Rakkas`, `Qahiri`, `Katibeh`, `Jomhuria`, `Vibes`, `AmiriQuran` — consumed by Tasks 2 and 3.

- [ ] **Step 1: Download the eight TTFs from the Google Fonts repo**

All are OFL. From the repo root, PowerShell:

```powershell
$base = 'https://raw.githubusercontent.com/google/fonts/main/ofl'
$map = @{
  'lateef-arabic-400.ttf'      = "$base/lateef/Lateef-Regular.ttf"
  'lateef-arabic-700.ttf'      = "$base/lateef/Lateef-Bold.ttf"
  'rakkas-arabic-400.ttf'      = "$base/rakkas/Rakkas-Regular.ttf"
  'qahiri-arabic-400.ttf'      = "$base/qahiri/Qahiri-Regular.ttf"
  'katibeh-arabic-400.ttf'     = "$base/katibeh/Katibeh-Regular.ttf"
  'jomhuria-arabic-400.ttf'    = "$base/jomhuria/Jomhuria-Regular.ttf"
  'vibes-arabic-400.ttf'       = "$base/vibes/Vibes-Regular.ttf"
  'amiri-quran-arabic-400.ttf' = "$base/amiriquran/AmiriQuran-Regular.ttf"
}
foreach ($k in $map.Keys) {
  Invoke-WebRequest -Uri $map[$k] -OutFile "assets/fonts/$k"
}
```

If any 404s, list the directory first, then re-fetch:
`Invoke-RestMethod "https://api.github.com/repos/google/fonts/contents/ofl/<slug>" | Select-Object name`

- [ ] **Step 2: Verify every file is a real, non-empty TTF**

Run:
```powershell
Get-ChildItem assets/fonts/lateef-arabic-400.ttf,assets/fonts/lateef-arabic-700.ttf,assets/fonts/rakkas-arabic-400.ttf,assets/fonts/qahiri-arabic-400.ttf,assets/fonts/katibeh-arabic-400.ttf,assets/fonts/jomhuria-arabic-400.ttf,assets/fonts/vibes-arabic-400.ttf,assets/fonts/amiri-quran-arabic-400.ttf |
  Select-Object Name,Length |
  Where-Object { $_.Length -lt 1000 }
```
Expected: no rows (a row means a truncated/HTML error page, not a font).

- [ ] **Step 3: Add the `fontAssets` entries**

In `src/theme/fonts.ts`, after the `Geist-Bold` line inside `fontAssets`, add:

```ts
  Lateef: require('@/assets/fonts/lateef-arabic-400.ttf'),
  'Lateef-Bold': require('@/assets/fonts/lateef-arabic-700.ttf'),
  Rakkas: require('@/assets/fonts/rakkas-arabic-400.ttf'),
  Qahiri: require('@/assets/fonts/qahiri-arabic-400.ttf'),
  Katibeh: require('@/assets/fonts/katibeh-arabic-400.ttf'),
  Jomhuria: require('@/assets/fonts/jomhuria-arabic-400.ttf'),
  Vibes: require('@/assets/fonts/vibes-arabic-400.ttf'),
  AmiriQuran: require('@/assets/fonts/amiri-quran-arabic-400.ttf'),
```

- [ ] **Step 4: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors).

```bash
git add assets/fonts src/theme/fonts.ts
git commit -m "feat(fonts): vendor 8 OFL Arabic faces

Lateef, Rakkas, Qahiri, Katibeh, Jomhuria, Vibes, Amiri Quran (and Lateef Bold).
Sources: https://github.com/google/fonts (SIL OFL)."
```

---

### Task 2: The pure family registry and its check

**Files:**
- Create: `src/theme/font-families.ts`, `scripts/check-fonts.mjs`
- Modify: `scripts/verify.mjs`, `AGENTS.md`

**Interfaces:**
- Consumes: the `fontAssets` keys from Task 1.
- Produces: `fontFamilies`, `familyForVariant(fontKey)`, `variantFor(fontKey)`, types `FontFamily`, `FontVariant` — consumed by Tasks 3–5.

- [ ] **Step 1: Write the registry**

Create `src/theme/font-families.ts`:

```ts
import type { FontKey } from './fonts';

/** One pickable face: a keyed asset plus its weight and localized name. */
export interface FontVariant {
  key: FontKey;
  labelAr: string;
  labelEn: string;
  /** Static weight the file ships. 400 for single-weight faces. */
  weight: number;
}

/**
 * A typeface family: one or more weight variants sharing a name and style.
 *
 * Grouping is by typeface (not by script style): "the same font, different
 * styles", which is how the picker presents them. The style tag is the
 * calligraphic label shown beneath the specimen.
 */
export interface FontFamily {
  key: string;
  labelAr: string;
  labelEn: string;
  styleTagAr: string;
  styleTagEn: string;
  /** The variant selected when the family is first chosen. */
  defaultVariant: FontKey;
  variants: readonly FontVariant[];
}

export const fontFamilies: readonly FontFamily[] = [
  {
    key: 'amiri',
    labelAr: 'أميري',
    labelEn: 'Amiri',
    styleTagAr: 'نسخ',
    styleTagEn: 'Naskh',
    defaultVariant: 'Amiri',
    variants: [
      { key: 'Amiri', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
      { key: 'Amiri-Bold', labelAr: 'عريض', labelEn: 'Bold', weight: 700 },
    ],
  },
  {
    key: 'amiri-quran',
    labelAr: 'أميري قرآن',
    labelEn: 'Amiri Quran',
    styleTagAr: 'قرآن',
    styleTagEn: 'Quran',
    defaultVariant: 'AmiriQuran',
    variants: [
      { key: 'AmiriQuran', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'lateef',
    labelAr: 'لطيف',
    labelEn: 'Lateef',
    styleTagAr: 'نسخ تقليدي',
    styleTagEn: 'Traditional Naskh',
    defaultVariant: 'Lateef',
    variants: [
      { key: 'Lateef', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
      { key: 'Lateef-Bold', labelAr: 'عريض', labelEn: 'Bold', weight: 700 },
    ],
  },
  {
    key: 'noto-naskh',
    labelAr: 'نوتو نسخ',
    labelEn: 'Noto Naskh',
    styleTagAr: 'نسخ محايد',
    styleTagEn: 'Neutral Naskh',
    defaultVariant: 'NotoNaskhArabic',
    variants: [
      {
        key: 'NotoNaskhArabic',
        labelAr: 'عادي',
        labelEn: 'Regular',
        weight: 400,
      },
      {
        key: 'NotoNaskhArabic-Bold',
        labelAr: 'عريض',
        labelEn: 'Bold',
        weight: 700,
      },
    ],
  },
  {
    key: 'aref-ruqaa',
    labelAr: 'عارف رقعة',
    labelEn: 'Aref Ruqaa',
    styleTagAr: 'رقعة',
    styleTagEn: "Ruq'a",
    defaultVariant: 'ArefRuqaa',
    variants: [
      { key: 'ArefRuqaa', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
      {
        key: 'ArefRuqaa-Bold',
        labelAr: 'عريض',
        labelEn: 'Bold',
        weight: 700,
      },
    ],
  },
  {
    key: 'rakkas',
    labelAr: 'ركّاس',
    labelEn: 'Rakkas',
    styleTagAr: 'رقعة عرضية',
    styleTagEn: "Ruq'a Display",
    defaultVariant: 'Rakkas',
    variants: [
      { key: 'Rakkas', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'reem-kufi',
    labelAr: 'ريم كوفي',
    labelEn: 'Reem Kufi',
    styleTagAr: 'كوفي حديث',
    styleTagEn: 'Modern Kufi',
    defaultVariant: 'ReemKufi',
    variants: [
      { key: 'ReemKufi', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
      { key: 'ReemKufi-Bold', labelAr: 'عريض', labelEn: 'Bold', weight: 700 },
    ],
  },
  {
    key: 'noto-kufi',
    labelAr: 'نوتو كوفي',
    labelEn: 'Noto Kufi',
    styleTagAr: 'كوفي',
    styleTagEn: 'Kufi',
    defaultVariant: 'NotoKufiArabic',
    variants: [
      {
        key: 'NotoKufiArabic',
        labelAr: 'عادي',
        labelEn: 'Regular',
        weight: 400,
      },
      {
        key: 'NotoKufiArabic-Bold',
        labelAr: 'عريض',
        labelEn: 'Bold',
        weight: 700,
      },
    ],
  },
  {
    key: 'qahiri',
    labelAr: 'قاهري',
    labelEn: 'Qahiri',
    styleTagAr: 'كوفي قديم',
    styleTagEn: 'Antique Kufic',
    defaultVariant: 'Qahiri',
    variants: [
      { key: 'Qahiri', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'katibeh',
    labelAr: 'كاتبة',
    labelEn: 'Katibeh',
    styleTagAr: 'ثلث',
    styleTagEn: 'Thuluth',
    defaultVariant: 'Katibeh',
    variants: [
      { key: 'Katibeh', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'jomhuria',
    labelAr: 'جمهورية',
    labelEn: 'Jomhuria',
    styleTagAr: 'ثلث عرضي',
    styleTagEn: 'Thuluth Display',
    defaultVariant: 'Jomhuria',
    variants: [
      { key: 'Jomhuria', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'lemonada',
    labelAr: 'ليمونادة',
    labelEn: 'Lemonada',
    styleTagAr: 'عرض حديث',
    styleTagEn: 'Modern Display',
    defaultVariant: 'Lemonada',
    variants: [
      { key: 'Lemonada', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
      { key: 'Lemonada-Bold', labelAr: 'عريض', labelEn: 'Bold', weight: 700 },
    ],
  },
  {
    key: 'vibes',
    labelAr: 'فايبس',
    labelEn: 'Vibes',
    styleTagAr: 'زخرفي',
    styleTagEn: 'Ornamental',
    defaultVariant: 'Vibes',
    variants: [
      { key: 'Vibes', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
];

const familyByVariant = new Map<string, FontFamily>();
for (const family of fontFamilies) {
  for (const variant of family.variants) {
    familyByVariant.set(variant.key, family);
  }
}

/** The family a stored `fontKey` belongs to, or undefined for an unknown key. */
export function familyForVariant(fontKey: string): FontFamily | undefined {
  return familyByVariant.get(fontKey);
}

/** The variant record for a stored `fontKey`, or undefined. */
export function variantFor(fontKey: string): FontVariant | undefined {
  const family = familyForVariant(fontKey);
  return family?.variants.find((v) => v.key === fontKey);
}
```

- [ ] **Step 2: Write the failing check**

Create `scripts/check-fonts.mjs`:

```js
/**
 * Standalone verification for the font family registry.
 *
 * Transpiles `src/theme/font-families.ts` in memory (it declares no value
 * imports, so this is safe) and pins the invariants the picker, Skia and the
 * SVG exporter rely on. `fontAssets` cannot be transpiled — it calls require()
 * on .ttf files — so its keys are extracted from source instead.
 *
 * Run: node scripts/check-fonts.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const familiesSource = readFileSync(
  join(here, '..', 'src', 'theme', 'font-families.ts'),
  'utf8',
);
const fontsSource = readFileSync(
  join(here, '..', 'src', 'theme', 'fonts.ts'),
  'utf8',
);

const { outputText } = ts.transpileModule(familiesSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});
const moduleShim = { exports: {} };
new Function('exports', 'module', outputText)(moduleShim.exports, moduleShim);
const { fontFamilies, familyForVariant, variantFor } = moduleShim.exports;

/** Keys declared in the `fontAssets` object literal, e.g. `Amiri: require(...)`. */
function fontAssetKeys(source) {
  const body = source.slice(source.indexOf('fontAssets'));
  const keys = new Set();
  for (const m of body.matchAll(/^\s{2}'?([A-Za-z-]+)'?:\s*require\(/gm)) {
    keys.add(m[1]);
  }
  return keys;
}

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`FAIL: ${msg}`);
};

const assets = fontAssetKeys(fontsSource);
if (assets.size === 0) {
  fail('extracted zero fontAssets keys — the regex no longer matches fonts.ts');
}

const seen = new Set();
const labels = new Set();
for (const family of fontFamilies) {
  if (family.variants.length === 0) {
    fail(`family ${family.key} has no variants`);
  }
  if (!family.variants.some((v) => v.key === family.defaultVariant)) {
    fail(`family ${family.key} defaultVariant is not one of its variants`);
  }
  const label = `${family.labelEn}|${family.styleTagEn}`;
  if (labels.has(label)) {
    fail(`two families share label + style tag: ${label}`);
  }
  labels.add(label);
  for (const v of family.variants) {
    if (!assets.has(v.key)) {
      fail(`variant ${v.key} has no fontAssets entry`);
    }
    if (seen.has(v.key)) {
      fail(`variant ${v.key} appears in two families`);
    }
    seen.add(v.key);
    if (familyForVariant(v.key) !== family) {
      fail(`familyForVariant(${v.key}) did not return its family`);
    }
    if (variantFor(v.key)?.key !== v.key) {
      fail(`variantFor(${v.key}) did not return its variant`);
    }
  }
}

// Every asset that is not a UI-only font must belong to a family.
const UI_ONLY = new Set([
  'Cairo',
  'Cairo-Bold',
  'Geist',
  'Geist-Medium',
  'Geist-SemiBold',
  'Geist-Bold',
]);
for (const key of assets) {
  if (!UI_ONLY.has(key) && !seen.has(key)) {
    fail(`fontAssets entry ${key} belongs to no family (orphan)`);
  }
}

if (failures > 0) {
  console.error(`\ncheck-fonts: ${failures} failure(s)`);
  process.exit(1);
}
console.log(`check-fonts: OK (${fontFamilies.length} families)`);
```

- [ ] **Step 3: Run the check**

Run: `node scripts/check-fonts.mjs`
Expected: `check-fonts: OK (13 families)`. To prove it bites, temporarily
comment out one `fontAssets` entry and re-run — it must fail with
`variant X has no fontAssets entry`; restore it after.

- [ ] **Step 4: Register the check**

In `scripts/verify.mjs`, add to `TASKS` after the `help` entry:

```js
  { id: 'fonts', command: [join(here, 'check-fonts.mjs')] },
```

Update the header comment: `the seven `check-*` scripts` → `the eight `check-*` scripts`.
In `AGENTS.md`, add `node scripts/check-fonts.mjs  # family registry + asset invariants` to the individual-checks list and bump "all seven checks" → "all eight checks".

- [ ] **Step 5: Commit**

```bash
git add src/theme/font-families.ts scripts/check-fonts.mjs scripts/verify.mjs AGENTS.md
git commit -m "feat(theme): add pure font family registry and check-fonts"
```

---

### Task 3: Retire `calligraphyFonts` and switch consumers to the registry

**Files:**
- Modify: `src/theme/fonts.ts` (delete `calligraphyFonts`), `src/theme/index.ts`, `src/editor/export/svg.ts`, `src/editor/EditorScreen.tsx`

**Interfaces:**
- Consumes: `fontFamilies`, `familyForVariant`, `variantFor` (Task 2).
- Produces: `svg.ts` `familyForKey` now returns the variant key itself; `EditorScreen` derives labels from the registry.

- [ ] **Step 1: Delete `calligraphyFonts` and re-export the registry**

In `src/theme/fonts.ts`, remove the entire `calligraphyFonts` block (from `/** Calligraphy families available as editable text styles in the editor. */` to the closing `] as const;`). At the top of the file, after the `fontAssets` declaration, add:

```ts
export {
  familyForVariant,
  fontFamilies,
  variantFor,
} from './font-families';
export type { FontFamily, FontVariant } from './font-families';
```

In `src/theme/index.ts:10`, replace:
```ts
export { calligraphyFonts, fontAssets, fontRoles } from './fonts';
export type { FontKey, FontRoles } from './fonts';
```
with:
```ts
export { fontAssets, fontRoles } from './fonts';
export type { FontKey, FontRoles } from './fonts';
export { familyForVariant, fontFamilies, variantFor } from './font-families';
export type { FontFamily, FontVariant } from './font-families';
```

- [ ] **Step 2: Make the SVG exporter embed the exact variant**

In `src/editor/export/svg.ts`, change the import at line 15 and rewrite `familyForKey`:

```ts
import { fontAssets } from '@/theme';
```
```ts
/**
 * The `@font-face` family name for a stored fontKey.
 *
 * The key names the exact variant, and its own asset is embedded under that
 * name — so `Amiri-Bold` exports the bold file rather than collapsing to the
 * regular Amiri face. Unknown keys fall back to Amiri.
 */
function familyForKey(fontKey: string): string {
  return fontKey in fontAssets ? fontKey : 'Amiri';
}
```

This makes `collectUsedFamilies` return variant keys and `collectSvgFontFaces` embed `fontAssets[<key>]` — no `@font-face` weight needed, because the family name *is* the variant.

- [ ] **Step 3: Migrate `EditorScreen.tsx` off `calligraphyFonts`**

Replace the import at `EditorScreen.tsx:114` (`calligraphyFonts,`) with `fontFamilies, familyForVariant,`. Replace the draft-label derivation at lines 572-576:

```ts
  /** The face the text sheet is previewing, for the preview's caption. */
  const draftFontMeta = familyForVariant(draftFont);
  const draftFontLabel = draftFontMeta
    ? `${language === 'ar' ? draftFontMeta.labelAr : draftFontMeta.labelEn} · ${
        language === 'ar'
          ? variantFor(draftFont)?.labelAr
          : variantFor(draftFont)?.labelEn
      }`
    : '';
```

Import `variantFor` alongside the others. In `openTextSheet` (`EditorScreen.tsx:1084`) replace `setDraftFont(calligraphyFonts[0].key)` with `setDraftFont(fontFamilies[0].defaultVariant)`. Leave the picker JSX (lines 2118-2128) unchanged for now — Task 4 replaces it.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. (If `calligraphyFonts` is still referenced anywhere, fix that reference to the registry.)

- [ ] **Step 5: Commit**

```bash
git add src/theme/fonts.ts src/theme/index.ts src/editor/export/svg.ts src/editor/EditorScreen.tsx
git commit -m "refactor(theme): retire calligraphyFonts for the family registry"
```

---

### Task 4: The family grid + variant chips (Layout A)

**Files:**
- Create: `src/editor/font-picker.tsx`
- Modify: `src/editor/EditorScreen.tsx` (render `FontPicker`), `src/i18n/strings.ts`

**Interfaces:**
- Consumes: `fontFamilies`, `familyForVariant`, `variantFor`, theme tokens, `useT`.
- Produces: `FontPicker({ value, onChange })` where `value: string` is the current `fontKey` and `onChange(fontKey)` sets the draft.

- [ ] **Step 1: Add the UI strings**

In `src/i18n/strings.ts`, add to the `editor` block (both `ar` and `en` objects), after `fontSize`:

```ts
    /** Grouping label above the family grid. */
    fontFamily: string;
    /** Grouping label above the variant chips. */
    variant: string;
```
Arabic: `fontFamily: 'الخط'`, `variant: 'النمط'`. English: `fontFamily: 'Font'`, `variant: 'Style'`.

- [ ] **Step 2: Write `FontPicker`**

Create `src/editor/font-picker.tsx`:

```tsx
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { fontFamilies, fontRoles, radius, spacing, typeScale } from '@/theme';

export interface FontPickerProps {
  /** The current `fontKey` (a variant key). */
  value: string;
  /** Called with the chosen variant key. */
  onChange: (fontKey: string) => void;
}

/**
 * Family grid + inline variant chips (design: Layout A).
 *
 * The family tile renders its own name in its own face, so the letterform is
 * the specimen. Selecting a family reveals only the variants that family
 * ships; a single-variant family shows no chip row.
 */
export function FontPicker({ value, onChange }: FontPickerProps) {
  const { colors: c } = useTheme();
  const { t, language } = useT();
  const uiFont = fontRoles[language].ui;
  const activeFamily =
    fontFamilies.find((f) => f.variants.some((v) => v.key === value)) ??
    fontFamilies[0];

  const label = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <View style={styles.root}>
      <Text style={[styles.sectionLabel, { color: c.muted, fontFamily: uiFont }]}>
        {t.editor.fontFamily}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.grid}
      >
        {fontFamilies.map((family) => {
          const selected = family.key === activeFamily.key;
          return (
            <AnimatedPressable
              key={family.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label(family.labelAr, family.labelEn)}, ${label(
                family.styleTagAr,
                family.styleTagEn,
              )}`}
              onPress={() => onChange(family.defaultVariant)}
              style={[
                styles.tile,
                {
                  borderColor: selected ? c.ink : c.border,
                  backgroundColor: selected ? c.surfaceAlt : c.surface,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.tileSpecimen, { color: c.ink, fontFamily: family.defaultVariant }]}
              >
                {label(family.labelAr, family.labelEn)}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.tileTag, { color: c.muted, fontFamily: uiFont }]}
              >
                {label(family.styleTagAr, family.styleTagEn)}
              </Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>

      {activeFamily.variants.length > 1 && (
        <>
          <Text
            style={[styles.sectionLabel, { color: c.muted, fontFamily: uiFont }]}
          >
            {t.editor.variant}
          </Text>
          <View style={styles.chips}>
            {activeFamily.variants.map((variant) => {
              const selected = variant.key === value;
              return (
                <AnimatedPressable
                  key={variant.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={label(variant.labelAr, variant.labelEn)}
                  onPress={() => onChange(variant.key)}
                  style={[
                    styles.chip,
                    {
                      borderColor: selected ? c.ink : c.border,
                      backgroundColor: selected ? c.ink : c.surfaceAlt,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: selected ? c.onInk : c.ink,
                      fontFamily: uiFont,
                      fontSize: typeScale.caption.size,
                    }}
                  >
                    {label(variant.labelAr, variant.labelEn)}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  sectionLabel: {
    fontSize: typeScale.caption.size,
    lineHeight: typeScale.caption.lineHeight,
  },
  grid: { gap: spacing.sm, paddingVertical: spacing.xs },
  tile: {
    minWidth: 132,
    minHeight: 56,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    gap: 2,
  },
  tileSpecimen: { fontSize: 20 },
  tileTag: { fontSize: typeScale.caption.size },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

Confirm `AnimatedPressable` is exported from `@/components/ui` (it is: `src/components/ui/pressable.tsx`, re-exported by the barrel). If the barrel name differs, import from `@/components/ui/pressable`.

- [ ] **Step 3: Render it in the Text sheet**

In `src/editor/EditorScreen.tsx`, replace the flat `styles.fontRow` block (lines 2118-2128) with:

```tsx
            <FontPicker value={draftFont} onChange={setDraftFont} />
```

Add `import { FontPicker } from '@/editor/font-picker';` with the other editor imports. Delete the now-unused `fontRow`/`fontBtn` styles and the `Button` usage that only served them if nothing else uses it.

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src --cache --cache-location .eslintcache`
Expected: PASS.

- [ ] **Step 5: Manual device check**

Run the app, open the Text sheet, and confirm: the tile specimen renders in each family's own face; a multi-variant family shows chips; selecting Qahiri/Rakkas/Katibeh/Jomhuria/Vibes/Amiri Quran shows **no** chip row; the preview updates on both levels.

- [ ] **Step 6: Commit**

```bash
git add src/editor/font-picker.tsx src/editor/EditorScreen.tsx src/i18n/strings.ts
git commit -m "feat(editor): family grid and variant chips font picker"
```

---

### Task 5: Make the variant row the source of truth for weight

**Files:**
- Modify: `src/theme/presentations.ts`, `src/editor/EditorScreen.tsx`

**Interfaces:**
- Consumes: `familyForVariant` (Task 2).
- Produces: `boldSiblingForKey` unchanged; `regularSiblingForKey` replaced by a registry-based default.

- [ ] **Step 1: Route Classic through the family default**

In `src/theme/presentations.ts`, import `familyForVariant` from `./font-families` and add:

```ts
/** The variant a family declares as its default, for the Classic reset. */
export function defaultVariantForKey(fontKey: string): string {
  return familyForVariant(fontKey)?.defaultVariant ?? fontKey;
}
```

Change the `classic` preset's `resolve` to:

```ts
    resolve: (obj) => ({
      fontKey: defaultVariantForKey(obj.fontKey),
      lineHeight: Math.round(obj.fontSize * DEFAULT_LEADING_RATIO),
      opacity: 1,
      shadows: undefined,
    }),
```

- [ ] **Step 2: Hide the Bold preset when the family has no bold**

In `src/editor/EditorScreen.tsx`, where the Style sheet maps `presentations` (line ~2156), filter out `bold` when the selected face has no bold sibling:

```tsx
                  {presentations
                    .filter(
                      (preset) =>
                        preset.key !== 'bold' ||
                        !!selectedText &&
                          boldSiblingForKey(selectedText.fontKey) !== null,
                    )
                    .map((preset) => {
```

Import `boldSiblingForKey` from `@/theme`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual device check (Review Focus 2–4)**

- Select a single-variant family → the Bold preset is absent.
- Toggle Bold on a multi-variant family, close and reopen the Text sheet → the Bold chip is active.
- Tap Classic after Bold → the family's default variant is active.

- [ ] **Step 5: Commit**

```bash
git add src/theme/presentations.ts src/editor/EditorScreen.tsx
git commit -m "fix(editor): variant row owns weight; classic resets to family default"
```

---

### Task 6: Pin the SVG export and update the render contract

**Files:**
- Modify: `docs/editor-render-contract.md`

**Interfaces:**
- Consumes: Task 3's per-variant `familyForKey`.

- [ ] **Step 1: Add the regression check**

`check-fonts.mjs` already proves every variant key has an asset — the same key the exporter embeds. Add to Task 2's script (this task) an assertion that `svg.ts` no longer imports `calligraphyFonts`:

```js
const svgSource = readFileSync(
  join(here, '..', 'src', 'editor', 'export', 'svg.ts'),
  'utf8',
);
if (svgSource.includes('calligraphyFonts')) {
  fail('svg.ts still references the retired calligraphyFonts');
}
```

- [ ] **Step 2: Run the full suite**

Run: `node scripts/verify.mjs`
Expected: all tasks PASS, including `fonts`.

- [ ] **Step 3: Update the render contract**

In `docs/editor-render-contract.md` §8, replace the `familyForKey` sentence (lines ~185-186) with:

> `familyForKey` returns the stored `fontKey` itself when it names a known
> asset, so the exact variant is embedded — a bold object embeds its bold file,
> not the regular one. An unknown key falls back to `Amiri`.

- [ ] **Step 4: Export check**

Export an SVG from a bold text object and confirm the embedded `@font-face` base64 decodes to the bold TTF (its size matches `amiri-arabic-700.ttf`, not `...-400`).

- [ ] **Step 5: Commit**

```bash
git add scripts/check-fonts.mjs docs/editor-render-contract.md
git commit -m "fix(export): embed the exact font variant in SVG; document it"
```

---

### Task 7: Final verification

- [ ] **Step 1: Full suite**

Run: `node scripts/verify.mjs`
Expected: typecheck, lint and all eight checks PASS.

- [ ] **Step 2: Review-focus sweep** — walk all five lines in Review Focus on device, including a project saved with `Cairo` as its `fontKey`.

- [ ] **Step 3: Size check**

Record `(Get-ChildItem assets/fonts | Measure-Object Length -Sum).Sum` and confirm the growth is within the ~3 MB estimate; if cold start regressed, file a follow-up for lazy editor-face loading (spec §10).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore(fonts): verify family picker and record size delta"
```
