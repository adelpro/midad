/**
 * Standalone verification for the font-pin identity.
 *
 * Transpiles `src/theme/font-pins.ts` (it declares no imports, so this is safe)
 * and pins the pin-id format the store, the picker and the contract rely on:
 * the `family:`/`google:` namespaces (which keep `family:amiri` and
 * `google:amiri` distinct), the parse round-trip, and the pure list operations
 * that order the store.
 *
 * Run: node scripts/check-font-pins.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const sourceFile = join(root, 'src', 'theme', 'font-pins.ts');

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
  familyPinId,
  googlePinId,
  parseFontPinId,
  isFontPinId,
  togglePinnedId,
  setPinnedId,
} = moduleShim.exports;

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`FAIL: ${msg}`);
};

// ── builders ────────────────────────────────────────────────────────────────
if (familyPinId('amiri') !== 'family:amiri') {
  fail(`familyPinId('amiri') = ${familyPinId('amiri')}`);
}
if (googlePinId('markazi-text') !== 'google:markazi-text') {
  fail(`googlePinId('markazi-text') = ${googlePinId('markazi-text')}`);
}

// ── parse round-trip ────────────────────────────────────────────────────────
for (const [id, expectedSource, expectedKey] of [
  ['family:amiri', 'family', 'amiri'],
  ['google:markazi-text', 'google', 'markazi-text'],
  ['family:noto-naskh', 'family', 'noto-naskh'],
]) {
  const parsed = parseFontPinId(id);
  if (
    !parsed ||
    parsed.source !== expectedSource ||
    parsed.key !== expectedKey
  ) {
    fail(`parseFontPinId(${id}) = ${JSON.stringify(parsed)}`);
  }
}

// ── the collision stays distinct ────────────────────────────────────────────
if (familyPinId('amiri') === googlePinId('amiri')) {
  fail('family:amiri and google:amiri must be different ids');
}
const fromFamily = parseFontPinId(familyPinId('amiri'));
const fromGoogle = parseFontPinId(googlePinId('amiri'));
if (!fromFamily || !fromGoogle || fromFamily.source === fromGoogle.source) {
  fail('family:amiri and google:amiri must parse to different sources');
}

// ── rejects ─────────────────────────────────────────────────────────────────
for (const bad of [
  '',
  'amiri',
  'family:',
  'google:',
  'family:Amiri',
  'google:Amiri',
  'google:a:b',
  'Family:amiri',
  'remote:amiri:400',
]) {
  if (parseFontPinId(bad) !== null) {
    fail(`parseFontPinId accepted an invalid id: ${bad}`);
  }
  if (isFontPinId(bad)) {
    fail(`isFontPinId accepted an invalid id: ${bad}`);
  }
}

// ── list operations (the store's ordering, kept pure) ───────────────────────
if (togglePinnedId(['family:amiri'], 'family:amiri').length !== 0) {
  fail('togglePinnedId must remove an existing id');
}
if (
  togglePinnedId(['family:amiri'], 'google:markazi-text').join(',') !==
  'google:markazi-text,family:amiri'
) {
  fail('togglePinnedId must prepend a new id');
}
if (togglePinnedId(['family:amiri'], 'family:amiri').includes('family:amiri')) {
  fail('togglePinnedId must not leave a duplicate');
}
if (setPinnedId(['family:amiri'], 'family:amiri', true) !== null) {
  fail('setPinnedId must return null when already pinned');
}
if (setPinnedId([], 'family:amiri', false) !== null) {
  fail('setPinnedId must return null when already unpinned');
}
if (setPinnedId([], 'google:amiri', true).join(',') !== 'google:amiri') {
  fail('setPinnedId must prepend when pinning');
}
if (
  setPinnedId(['family:amiri', 'google:amiri'], 'family:amiri', false).join(
    ',',
  ) !== 'google:amiri'
) {
  fail('setPinnedId must filter when unpinning');
}

// ── source purity (the check depends on it) ─────────────────────────────────
if (/^\s*import\s/m.test(source)) {
  fail(
    'font-pins.ts must declare no imports (the check transpiles it standalone)',
  );
}
if (/react-native|require\(/.test(source)) {
  fail('font-pins.ts must not reference React Native or require()');
}

// ── sibling store exists and is wired to the pure core ──────────────────────
const storePath = join(root, 'src', 'storage', 'font-pins.ts');
let storeSource = '';
try {
  storeSource = readFileSync(storePath, 'utf8');
} catch {
  fail(`missing font-pins store: ${storePath}`);
}
if (storeSource && !storeSource.includes('midad:font-pins')) {
  fail('font-pins store does not persist under midad:font-pins');
}
if (
  storeSource &&
  !storeSource.includes('togglePinnedId') &&
  !storeSource.includes('setPinnedId')
) {
  fail('font-pins store does not reuse the pure list operations');
}
if (storeSource && !storeSource.includes('pinnedCollapsed')) {
  fail('font-pins store does not persist the collapsed state');
}

// ── the picker reuses the pure core ─────────────────────────────────────────
const pickerPath = join(root, 'src', 'editor', 'font-picker-sheet.tsx');
let picker = '';
try {
  picker = readFileSync(pickerPath, 'utf8');
} catch {
  fail(`missing font picker: ${pickerPath}`);
}
if (picker && !picker.includes('useFontPins')) {
  fail('picker does not read the font-pins store');
}
if (
  picker &&
  (!picker.includes('familyPinId') || !picker.includes('googlePinId'))
) {
  fail('picker does not use the pure pin-id builders');
}
if (picker && !picker.includes('parseFontPinId')) {
  fail('picker does not use parseFontPinId');
}
if (picker && !picker.includes('humanizeRemoteFontId')) {
  fail('pinned remote rows must derive their name from the id');
}
if (picker && !picker.includes('parseRemoteFontKey')) {
  fail('pinned remote rows must derive installed weights from installed keys');
}
if (picker && !picker.includes('t.editor.pinnedFonts')) {
  fail('picker does not render the pinned section title');
}
if (picker && !/flexDirection:\s*'row'/.test(picker)) {
  fail('family rows must lay the body and the pin out in a row');
}
if (picker && !picker.includes('paddingStart')) {
  fail('family rows must use logical (RTL-safe) padding');
}
if (picker && !picker.includes('pinnedCollapsed')) {
  fail('picker does not read the pinned section collapsed state');
}
if (
  picker &&
  (!picker.includes('t.editor.collapsePinned') ||
    !picker.includes('t.editor.expandPinned'))
) {
  fail('picker does not label the pinned section collapse toggle');
}

if (failures > 0) {
  console.error(`\ncheck-font-pins: ${failures} failure(s)`);
  process.exit(1);
}
console.log('check-font-pins: OK');
