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

if (failures > 0) {
  console.error(`\ncheck-font-pins: ${failures} failure(s)`);
  process.exit(1);
}
console.log('check-font-pins: OK');
