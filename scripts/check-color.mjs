/**
 * Standalone verification for canvas content colour parsing.
 *
 * Transpiles `src/theme/color.ts` in memory (it declares no imports, so this is
 * safe) and pins the contract the picker and the document rely on: every
 * accepted spelling resolves to canonical `#rrggbb`, alpha is accepted and
 * dropped, and out-of-range values are rejected rather than clamped.
 *
 * Run: node scripts/check-color.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  join(here, '..', 'src', 'theme', 'color.ts'),
  'utf8',
);

const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});

const moduleShim = { exports: {} };
new Function('exports', 'module', outputText)(moduleShim.exports, moduleShim);
const { parseColor } = moduleShim.exports;

let failures = 0;
let cases = 0;

function check(input, expected) {
  cases += 1;
  const got = parseColor(input);
  if (got !== expected) {
    failures += 1;
    console.error(
      `FAIL: parseColor(${JSON.stringify(input)}) = ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`,
    );
  }
}

// Canonical passthrough, case, optional `#`, shorthand expansion.
check('#111111', '#111111');
check('#AABBCC', '#aabbcc');
check('#abc', '#aabbcc');
check('abc', '#aabbcc');
check('AABBCC', '#aabbcc');
check('  #FfF  ', '#ffffff');
check('000000', '#000000');

// CSS functional forms; alpha is validated then dropped.
check('rgb(255, 0, 0)', '#ff0000');
check('rgb(255,0,0)', '#ff0000');
check('rgb( 1 , 2 , 3 )', '#010203');
check('rgb(0, 128, 255)', '#0080ff');
check('rgba(255, 0, 0, 1)', '#ff0000');
check('rgba(255, 0, 0, 0.5)', '#ff0000');
check('rgba(1, 2, 3, .25)', '#010203');

// Rejections: malformed, wrong length, out of range, wrong arity.
check('', null);
check('   ', null);
check('notacolor', null);
check('red', null);
check('#12', null);
check('#1234', null);
check('#12345', null);
check('#gggggg', null);
check('rgb(0,0)', null);
check('rgb(0,0,0,0)', null);
check('rgb(300,0,0)', null);
check('rgb(-1,0,0)', null);
check('rgb(1.5,0,0)', null);
check('rgba(0,0,0)', null);
check('rgba(0,0,0,2)', null);
check('rgba(0,0,0,-0.1)', null);
check('rgba(256,0,0,1)', null);

// Recent-history reducer: dedupe case-insensitively, most recent first, capped.
const { pushRecent } = moduleShim.exports;

function checkRecent(colors, color, max, expected) {
  cases += 1;
  const got = pushRecent(colors, color, max);
  if (JSON.stringify(got) !== JSON.stringify(expected)) {
    failures += 1;
    console.error(
      `FAIL: pushRecent(${JSON.stringify(colors)}, ${JSON.stringify(color)}, ${max}) = ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`,
    );
  }
}

checkRecent([], '#112233', 8, ['#112233']);
checkRecent(['#111111'], '#222222', 8, ['#222222', '#111111']);
checkRecent(['#111111', '#222222'], '#222222', 8, ['#222222', '#111111']);
checkRecent(['#AABBCC', '#111111'], '#aabbcc', 8, ['#aabbcc', '#111111']);
checkRecent(
  ['#111111', '#222222', '#333333'],
  '#444444',
  3,
  ['#444444', '#111111', '#222222'],
);

if (failures > 0) {
  console.error(`\ncheck-color: ${failures} failure(s)`);
  process.exit(1);
}
console.log(`check-color: OK (${cases} cases)`);
