/**
 * Standalone verification for the layout-direction decision.
 *
 * Transpiles `src/i18n/rtl-direction.ts` in memory (it declares no value
 * imports, so this is safe) and pins the truth table the cold-start reload in
 * `src/i18n/apply-direction.ts` relies on.
 *
 * Run: node scripts/check-rtl-direction.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

let failures = 0;
function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

/** Transpile one module and return its exports. No value imports allowed. */
function loadModule(rel) {
  const source = readFileSync(join(root, rel), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const shim = { exports: {} };
  new Function('exports', 'module', outputText)(shim.exports, shim);
  return shim.exports;
}

let direction;
try {
  direction = loadModule('src/i18n/rtl-direction.ts');
} catch (error) {
  fail(`cannot load src/i18n/rtl-direction.ts: ${error.message}`);
}

if (direction) {
  const { desiredRTL, needsDirectionReload } = direction;
  if (typeof desiredRTL !== 'function' || typeof needsDirectionReload !== 'function') {
    fail('the module must export desiredRTL and needsDirectionReload');
  } else {
    // Arabic is the only RTL language the app ships.
    if (desiredRTL('ar') !== true) fail("desiredRTL('ar') must be true");
    if (desiredRTL('en') !== false) fail("desiredRTL('en') must be false");

    // Web is driven live by `document.documentElement.dir`, never by a reload.
    if (
      needsDirectionReload({
        platform: 'web',
        currentRTL: false,
        language: 'ar',
        lastForcedLanguage: null,
      }) !== false
    ) {
      fail('web must never reload for direction');
    }

    // The direction already matches: nothing to do.
    if (
      needsDirectionReload({
        platform: 'android',
        currentRTL: true,
        language: 'ar',
        lastForcedLanguage: null,
      }) !== false
    ) {
      fail('a matching direction must not reload');
    }

    // The defect being fixed: Arabic UI, native still LTR, never forced.
    if (
      needsDirectionReload({
        platform: 'android',
        currentRTL: false,
        language: 'ar',
        lastForcedLanguage: null,
      }) !== true
    ) {
      fail('a mismatched direction must reload once');
    }

    // Loop guard: already forced for this language and still mismatched means a
    // platform that will not flip — retrying would reload forever.
    if (
      needsDirectionReload({
        platform: 'android',
        currentRTL: false,
        language: 'ar',
        lastForcedLanguage: 'ar',
      }) !== false
    ) {
      fail('a second reload for the same language must be refused');
    }

    // A different language is a fresh decision.
    if (
      needsDirectionReload({
        platform: 'android',
        currentRTL: false,
        language: 'ar',
        lastForcedLanguage: 'en',
      }) !== true
    ) {
      fail('a different language must be allowed to reload');
    }

    // iOS behaves like Android here; both honour forceRTL on the next launch.
    if (
      needsDirectionReload({
        platform: 'ios',
        currentRTL: false,
        language: 'ar',
        lastForcedLanguage: null,
      }) !== true
    ) {
      fail('ios must reload on a mismatch');
    }
  }
}

if (failures > 0) {
  console.error(`\ncheck-rtl-direction: ${failures} failure(s)`);
  process.exit(1);
}
console.log('check-rtl-direction: OK');
