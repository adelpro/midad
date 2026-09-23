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

// The SVG exporter must not fall back to the retired flat list.
const svgSource = readFileSync(
  join(here, '..', 'src', 'editor', 'export', 'svg.ts'),
  'utf8',
);
if (svgSource.includes('calligraphyFonts')) {
  fail('svg.ts still references the retired calligraphyFonts');
}

// Unknown-key fallback must not be fooled by inherited names ('toString').
if (svgSource.includes(' in fontAssets')) {
  fail('svg.ts still uses `in fontAssets` (inherited keys) instead of hasOwn');
}
const skiaTextSource = readFileSync(
  join(here, '..', 'src', 'editor', 'skia', 'text.ts'),
  'utf8',
);
if (skiaTextSource.includes(' in fontAssets')) {
  fail('skia/text.ts still uses `in fontAssets` instead of hasOwn');
}

// Classic must strip a legacy bold suffix for a family the registry dropped.
const { defaultVariantForKey } = moduleShim.exports;
for (const [input, expected] of [
  ['Amiri-Bold', 'Amiri'],
  ['Cairo-Bold', 'Cairo'],
  ['Cairo', 'Cairo'],
  ['Vibes', 'Vibes'],
  ['does-not-exist', 'does-not-exist'],
]) {
  const got = defaultVariantForKey?.(input);
  if (got !== expected) {
    fail(`defaultVariantForKey(${input}) = ${got}, expected ${expected}`);
  }
}

// Exported SVG text must actually name the embedded family, or @font-face is
// dead weight (the viewer would render in its default font).
let svgTextSource = '';
try {
  svgTextSource = readFileSync(
    join(here, '..', 'src', 'editor', 'export', 'svg-text.ts'),
    'utf8',
  );
} catch {
  fail('src/editor/export/svg-text.ts is missing (text serializer)');
}
if (svgTextSource) {
  const { outputText: textOut } = ts.transpileModule(svgTextSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const textShim = { exports: {} };
  new Function('exports', 'module', textOut)(textShim.exports, textShim);
  const { textToSvg } = textShim.exports;
  const svg = textToSvg?.(['أ'], 40, 50, '#000000', 'Amiri-Bold');
  if (typeof svg !== 'string' || !svg.includes('font-family="Amiri-Bold"')) {
    fail('textToSvg does not emit font-family for the object face');
  }
}

if (failures > 0) {
  console.error(`\ncheck-fonts: ${failures} failure(s)`);
  process.exit(1);
}
console.log(`check-fonts: OK (${fontFamilies.length} families)`);
