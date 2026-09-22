/**
 * Standalone verification for the undo-snackbar countdown math.
 *
 * Transpiles `src/components/ui/snackbar-timing.ts` in memory and pins the two
 * numbers the countdown shows: the whole seconds left, and the ring's arc. Both
 * are `'worklet'` (they run on the UI thread with Reanimated), so this also
 * guards the directives — a missing one throws on device and no linter sees it.
 *
 * Run: node scripts/check-countdown.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  join(here, '..', 'src', 'components', 'ui', 'snackbar-timing.ts'),
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
const { countdownDashOffset, secondsFromProgress } = moduleShim.exports;

let failures = 0;

function check(name, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (ok) {
    console.log(`  PASS  ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL  ${name}`);
  console.log(`        expected ${JSON.stringify(expected)}`);
  console.log(`        got      ${JSON.stringify(got)}`);
}

function ok(name, condition) {
  check(name, condition, true);
}

function section(title) {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------

section(
  'whole seconds left, rounded up so it never reads 0 while time remains',
);

check('a full window reads 5', secondsFromProgress(1, 5_000), 5);
check(
  'just under a second of time left still reads 1',
  secondsFromProgress(0.01, 5_000),
  1,
);
check('exactly one second left reads 1', secondsFromProgress(0.2, 5_000), 1);
check('half the window reads 3', secondsFromProgress(0.5, 5_000), 3);
check('the window expiring reads 0', secondsFromProgress(0, 5_000), 0);
check('a shorter window scales', secondsFromProgress(1, 3_000), 3);

section('out-of-range progress cannot produce an impossible label');

check(
  'progress above 1 clamps to the window',
  secondsFromProgress(1.5, 5_000),
  5,
);
check('negative progress clamps to 0', secondsFromProgress(-0.5, 5_000), 0);
check('a zero window never divides', secondsFromProgress(1, 0), 0);

// ---------------------------------------------------------------------------

section('the ring arc drains from whole to empty');

check('a full ring has no offset', countdownDashOffset(100, 1), 0);
check('an exhausted ring is fully offset', countdownDashOffset(100, 0), 100);
check(
  'a quarter spent leaves three quarters drawn',
  countdownDashOffset(100, 0.25),
  75,
);
check('out-of-range progress clamps', countdownDashOffset(100, 2), 0);

// ---------------------------------------------------------------------------

section('the module stays standalone and worklet-safe');

ok('snackbar-timing.ts declares no imports', !/^\s*import\b/m.test(source));
for (const name of ['secondsFromProgress', 'countdownDashOffset']) {
  ok(
    `${name} declares the worklet directive`,
    new RegExp(
      `function ${name}\\s*\\([^]*?\\)\\s*(?::[^{]+)?\\{\\s*'worklet';`,
    ).test(source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')),
  );
}

console.log(
  failures === 0
    ? '\nAll countdown checks passed.'
    : `\n${failures} countdown check(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
