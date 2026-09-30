/**
 * Standalone verification for the remote (Google Fonts) font subsystem.
 *
 * Transpiles `src/theme/remote-fonts.ts` in memory (it declares no imports at
 * all, so this is safe) and pins the invariants the picker, the font cache and
 * the SVG exporter will rely on: the `remote:<id>:<weight>` key format, the
 * face-status state machine, and the Fontsource CDN URL builder.
 *
 * Run: node scripts/check-remote-fonts.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const sourceFile = join(root, 'src', 'theme', 'remote-fonts.ts');

const source = readFileSync(sourceFile, 'utf8');

const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});
const moduleShim = { exports: {} };
new Function('exports', 'module', outputText)(moduleShim.exports, moduleShim);
const {
  isRemoteFontKey,
  remoteFontKey,
  parseRemoteFontKey,
  normalizeRemoteFontId,
  normalizeRemoteWeight,
  humanizeRemoteFontId,
  remoteFontLabel,
  faceStatusForKey,
  remoteFontTtfUrl,
  filterBundledDuplicates,
} = moduleShim.exports;

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`FAIL: ${msg}`);
};

// ── key format ────────────────────────────────────────────────────────────────
const accepted = [
  'remote:markazi-text:400',
  'remote:amiri-quran:700',
  'remote:noto-naskh-arabic:400',
];
for (const key of accepted) {
  if (!isRemoteFontKey(key)) {
    fail(`isRemoteFontKey rejected a valid key: ${key}`);
  }
}
const rejected = [
  'markazi-text',
  'remote:markazi-text',
  'remote:markazi-text:40',
  'remote:markazi-text:4000',
  'remote:markazi-text:400:extra',
  'remote:a:b:400',
  'Remote:markazi-text:400',
  'remote:Markazi-text:400',
  'remote:',
  '',
];
for (const key of rejected) {
  if (isRemoteFontKey(key)) {
    fail(`isRemoteFontKey accepted an invalid key: ${key}`);
  }
}

// ── build / parse round-trip ─────────────────────────────────────────────────
const built = remoteFontKey('Markazi Text', 700);
if (built !== 'remote:markazi-text:700') {
  fail(`remoteFontKey('Markazi Text', 700) = ${built}`);
}
for (const [id, weight] of [
  ['markazi-text', 400],
  ['Noto Naskh Arabic', 400],
  ['Cairo', 700],
]) {
  const key = remoteFontKey(id, weight);
  const parsed = parseRemoteFontKey(key);
  if (
    !parsed ||
    parsed.id !== normalizeRemoteFontId(id) ||
    parsed.weight !== weight
  ) {
    fail(`parse(remoteFontKey(${id}, ${weight})) did not round-trip`);
  }
}
if (parseRemoteFontKey('markazi-text') !== null) {
  fail('parseRemoteFontKey accepted a non-remote key');
}
if (parseRemoteFontKey('remote:markazi-text:4000') !== null) {
  fail('parseRemoteFontKey accepted an out-of-range weight');
}

// ── normalisers ──────────────────────────────────────────────────────────────
if (normalizeRemoteFontId('  Markazi   Text! ') !== 'markazi-text') {
  fail('normalizeRemoteFontId did not slugify');
}
if (normalizeRemoteWeight(50) !== 100 || normalizeRemoteWeight(1200) !== 900) {
  fail('normalizeRemoteWeight did not clamp to 100–900');
}
if (
  normalizeRemoteWeight(400.4) !== 400 ||
  normalizeRemoteWeight(Number.NaN) !== 400
) {
  fail('normalizeRemoteWeight fallback/rounding wrong');
}

// ── display labels ───────────────────────────────────────────────────────────
if (humanizeRemoteFontId('markazi-text') !== 'Markazi Text') {
  fail('humanizeRemoteFontId did not title-case a slug');
}
if (humanizeRemoteFontId('noto-naskh-arabic') !== 'Noto Naskh Arabic') {
  fail('humanizeRemoteFontId mishandled a multi-word slug');
}
if (remoteFontLabel('remote:markazi-text:700') !== 'Markazi Text · 700') {
  fail(
    `remoteFontLabel did not humanize a remote key: ${remoteFontLabel('remote:markazi-text:700')}`,
  );
}
if (remoteFontLabel('Amiri') !== null || remoteFontLabel('') !== null) {
  fail('remoteFontLabel must return null for non-remote keys');
}

// ── bundled-duplicate suppression ────────────────────────────────────────────
// A Google family whose name matches a bundled family is a duplicate *only*
// when the bundled copy already covers every weight Google offers. If Google
// has a weight the bundle lacks, it is a different, useful offer and stays.
const dupFamilies = [
  { id: 'amiri', family: 'Amiri', weights: [400, 700] },
  { id: 'noto-naskh-arabic', family: 'Noto Naskh Arabic', weights: [400, 700] },
  { id: 'kufam', family: 'Kufam', weights: [400, 500, 600, 700] },
  { id: 'amiri-quran', family: 'Amiri Quran', weights: [400] },
];
const bundledCover = new Map([
  ['amiri', [400, 700]], // bundled covers every weight Google offers -> dropped
  // The bundle keys this family `noto-naskh` and labels it "Noto Naskh", so the
  // only folded name that meets Google's `noto-naskh-arabic` is the *variant*
  // key `NotoNaskhArabic`. The coverage map is keyed off variant keys.
  ['notonaskharabic', [400, 700]],
  ['kufam', [400]], // bundled is 400-only, Google reaches 700 -> kept
]);
const kept = filterBundledDuplicates(dupFamilies, bundledCover);
const keptIds = kept.map((f) => f.id).sort();
if (JSON.stringify(keptIds) !== JSON.stringify(['amiri-quran', 'kufam'])) {
  fail(`filterBundledDuplicates kept ${JSON.stringify(keptIds)}`);
}
// A name match with no weight overlap claim is kept, never silently dropped.
if (
  filterBundledDuplicates(
    [{ id: 'amiri', family: 'Amiri', weights: [] }],
    bundledCover,
  ).length !== 1
) {
  fail('filterBundledDuplicates dropped a family with unknown weights');
}
// A completely unrelated family is never touched.
if (
  filterBundledDuplicates(
    [{ id: 'markazi-text', family: 'Markazi Text', weights: [400] }],
    bundledCover,
  ).length !== 1
) {
  fail('filterBundledDuplicates dropped an unrelated family');
}

// ── face status machine ──────────────────────────────────────────────────────
const bundled = (key) => key === 'Amiri' || key === 'Amiri-Bold';
const installed = (key) => key === 'remote:markazi-text:400';
const cases = [
  ['Amiri', 'bundled'],
  ['Amiri-Bold', 'bundled'],
  ['remote:markazi-text:400', 'remote-installed'],
  ['remote:markazi-text:700', 'remote-missing'],
  ['scheherazade-nowhere', 'unknown'],
  ['', 'unknown'],
];
for (const [key, expected] of cases) {
  const got = faceStatusForKey(key, bundled, installed);
  if (got !== expected) {
    fail(`faceStatusForKey(${key}) = ${got}, expected ${expected}`);
  }
}

// ── CDN URL builder ──────────────────────────────────────────────────────────
const url = remoteFontTtfUrl('Markazi Text', 400);
if (
  url !==
  'https://cdn.jsdelivr.net/fontsource/fonts/markazi-text@latest/arabic-400-normal.ttf'
) {
  fail(`remoteFontTtfUrl default = ${url}`);
}
const latin = remoteFontTtfUrl('amiri', 700, 'latin');
if (
  latin !==
  'https://cdn.jsdelivr.net/fontsource/fonts/amiri@latest/latin-700-normal.ttf'
) {
  fail(`remoteFontTtfUrl latin = ${latin}`);
}

// ── source purity (the check depends on it) ──────────────────────────────────
if (/^\s*import\s/m.test(source)) {
  fail(
    'remote-fonts.ts must declare no imports (the check transpiles it standalone)',
  );
}
if (/react-native|fontAssets|calligraphyFonts|require\(/.test(source)) {
  fail('remote-fonts.ts must not reference RN, fontAssets or require()');
}

// ── sibling modules exist and are wired to the pure core ─────────────────────
for (const file of [
  join(root, 'src', 'storage', 'remote-font-catalog.ts'),
  join(root, 'src', 'storage', 'remote-font-cache.ts'),
]) {
  try {
    readFileSync(file, 'utf8');
  } catch {
    fail(`missing remote-font module: ${file}`);
  }
}
const catalog = readFileSync(
  join(root, 'src', 'storage', 'remote-font-catalog.ts'),
  'utf8',
);
if (
  !catalog.includes('normalizeRemoteFontId') ||
  !catalog.includes('RemoteFontFamily')
) {
  fail('catalog module does not reuse the pure remote-fonts helpers');
}
const cache = readFileSync(
  join(root, 'src', 'storage', 'remote-font-cache.ts'),
  'utf8',
);
if (!cache.includes('remoteFontKey') || !cache.includes('remoteFontTtfUrl')) {
  fail('cache module does not reuse the pure remote-fonts helpers');
}

if (failures > 0) {
  console.error(`\ncheck-remote-fonts: ${failures} failure(s)`);
  process.exit(1);
}
console.log('check-remote-fonts: OK');
