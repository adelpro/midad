/**
 * Standalone verification for the gallery row's swipe geometry.
 *
 * The repo has no test runner, so this transpiles `src/components/gallery/swipe.ts`
 * in memory with the installed TypeScript and pins the invariants the reveal
 * depends on. Like the other checks it needs no tsconfig, no `@/` resolution and
 * writes nothing — which is why `swipe.ts` must declare no imports.
 *
 * The bug this locks down: the reveal's reach used to be a set of unnamed
 * literals inside a gesture callback. Stated here in dp, the assertions fail if
 * a flick can outrun the panel (a page-background sliver opens between card and
 * panel), if the rubber-band stops being monotonic or asymmetric, if the commit
 * threshold can be crossed with no real travel, or if RTL flips an intent.
 *
 * Run: node scripts/check-swipe.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  join(here, '..', 'src', 'components', 'gallery', 'swipe.ts'),
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
const {
  ACTION_W,
  ELASTIC_TRAVEL,
  PANEL_W,
  COMMIT_RATIO,
  FLICK_FLOOR,
  MAX_SETTLE_VELOCITY,
  PROJECTION_SECONDS,
  clampSettleVelocity,
  projectPosition,
  resolveSwipeSide,
  rubberband,
  settleTarget,
} = moduleShim.exports;

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

const EPS = 1e-6;
const near = (a, b) => Math.abs(a - b) < EPS;

const LTR = 1;
const RTL = -1;

// ---------------------------------------------------------------------------

section('the panel is exactly the reveal plus its give');

check(
  'PANEL_W adds the give to the reveal',
  PANEL_W,
  ACTION_W + ELASTIC_TRAVEL,
);

for (const dir of [LTR, RTL]) {
  for (const side of ['leading', 'trailing']) {
    ok(
      `a full ${side} reveal is covered by the panel (dir ${dir})`,
      Math.abs(settleTarget(side, dir)) <= PANEL_W,
    );
  }
}

// The widest a *drag* can push the card is the rubber-band asymptote, PANEL_W
// itself. A still release from rest adds the latch spring's overshoot —
// 0.0288·v at ζ 0.6 / stiffness 300 (tokens.ts `springs.elastic`) — worst case at
// MAX_SETTLE_VELOCITY. Both must stay inside PANEL_W or a sliver of page
// background opens between card and panel.
const MAX_OVERSHOOT = 0.0288 * MAX_SETTLE_VELOCITY;
ok(
  `a from-rest latch overshoot (${MAX_OVERSHOOT.toFixed(1)}dp) fits the give`,
  ACTION_W + MAX_OVERSHOOT <= PANEL_W,
);
ok(
  'the rubber-band asymptote is the panel width, not past it',
  rubberband(1e6) <= PANEL_W + EPS && rubberband(1e6) > PANEL_W - 1,
);

// Known, pre-existing limitation this bound does NOT cover: releasing *outward
// from inside the give* (an already-open row flicked further out) springs from a
// start already past ACTION_W, so the peak can exceed PANEL_W and show background
// for ~150ms. The plan freezes geometry, so this is a product ruling (see the
// ledger), not a regression. Simulating the spring here keeps the honest number
// in view and fails if the gap grows.
function peakAfterRelease(x0, v0, target) {
  // springs.elastic: ζ 0.6, stiffness 300, mass 1.
  const k = 300;
  const c = 2 * 0.6 * Math.sqrt(k);
  const dt = 1 / 2000;
  let x = x0;
  let v = v0;
  let peak = x0;
  for (let i = 0; i < 2000; i += 1) {
    const a = -k * (x - target) - c * v;
    v += a * dt;
    x += v * dt;
    if (x > peak) peak = x;
  }
  return peak;
}

let worstGiveZonePeak = 0;
for (const drag of [1, 30, 100, 200, 300, 400]) {
  const x0 = rubberband(ACTION_W + drag);
  worstGiveZonePeak = Math.max(
    worstGiveZonePeak,
    peakAfterRelease(x0, MAX_SETTLE_VELOCITY, settleTarget('leading', LTR)),
  );
}
const GIVE_ZONE_LIMIT = 20;
ok(
  `the known give-zone release peak (${worstGiveZonePeak.toFixed(1)}dp) stays within ${GIVE_ZONE_LIMIT}dp of the panel`,
  worstGiveZonePeak < PANEL_W + GIVE_ZONE_LIMIT,
);

// ---------------------------------------------------------------------------

section('the rubber-band is identity inside the reveal, elastic outside');

check('at rest nothing moves', rubberband(0), 0);
check(
  'inside the reveal the card tracks 1:1',
  rubberband(ACTION_W * 0.5),
  ACTION_W * 0.5,
);
check('exactly at the reveal it still tracks', rubberband(ACTION_W), ACTION_W);

ok(
  'past the reveal it gives, never stops dead',
  rubberband(ACTION_W + 1) > ACTION_W,
);
ok(
  'past the reveal it never exceeds the panel',
  rubberband(ACTION_W + 1) < PANEL_W,
);

let monotonic = true;
let previous = rubberband(ACTION_W);
for (let over = 1; over <= 400; over += 7) {
  const value = rubberband(ACTION_W + over);
  if (value < previous) monotonic = false;
  previous = value;
}
ok(
  'the resistance is monotonic — dragging further never pulls back',
  monotonic,
);

ok(
  'the give is symmetric',
  near(rubberband(-(ACTION_W + 30)), -rubberband(ACTION_W + 30)),
);

// ---------------------------------------------------------------------------

section('RTL mirrors the intent, not the action');

check('LTR leading sits to the right', settleTarget('leading', LTR), ACTION_W);
check(
  'LTR trailing sits to the left',
  settleTarget('trailing', LTR),
  -ACTION_W,
);
check('RTL leading sits to the left', settleTarget('leading', RTL), -ACTION_W);
check(
  'RTL trailing sits to the right',
  settleTarget('trailing', RTL),
  ACTION_W,
);
check('rest is zero in both directions', settleTarget(null, RTL), 0);

// ---------------------------------------------------------------------------

section('momentum projection is the documented window');

check(
  'projection adds v · PROJECTION_SECONDS',
  projectPosition(0, 0, 100),
  100 * PROJECTION_SECONDS,
);
check('projection includes the travel so far', projectPosition(20, 30, 0), 50);

// ---------------------------------------------------------------------------

section('the commit decision needs travel AND a projected threshold');

const travel = (fraction) => ACTION_W * fraction;

check(
  'below the flick floor, a huge velocity cannot latch',
  resolveSwipeSide({
    startX: 0,
    translationX: FLICK_FLOOR - 1,
    velocityX: 5000,
    dir: LTR,
  }),
  null,
);
check(
  'a still release past the ratio latches leading',
  resolveSwipeSide({
    startX: 0,
    translationX: travel(COMMIT_RATIO + 0.01),
    velocityX: 0,
    dir: LTR,
  }),
  'leading',
);
check(
  'a still release short of the ratio returns',
  resolveSwipeSide({
    startX: 0,
    translationX: travel(COMMIT_RATIO - 0.01),
    velocityX: 0,
    dir: LTR,
  }),
  null,
);
check(
  'the threshold itself does not latch (strict >)',
  resolveSwipeSide({
    startX: 0,
    translationX: travel(COMMIT_RATIO),
    velocityX: 0,
    dir: LTR,
  }),
  null,
);
check(
  'a real flick past the floor latches on velocity alone',
  resolveSwipeSide({
    startX: 0,
    translationX: travel(0.2),
    velocityX: 200,
    dir: LTR,
  }),
  'leading',
);
check(
  'RTL flips an identical rightward gesture to trailing',
  resolveSwipeSide({
    startX: 0,
    translationX: travel(0.5),
    velocityX: 0,
    dir: RTL,
  }),
  'trailing',
);
check(
  'RTL flips an identical leftward gesture to leading',
  resolveSwipeSide({
    startX: 0,
    translationX: -travel(0.5),
    velocityX: 0,
    dir: RTL,
  }),
  'leading',
);
check(
  'a no-move release from an open row returns to rest',
  resolveSwipeSide({
    startX: settleTarget('leading', LTR),
    translationX: 0,
    velocityX: 0,
    dir: LTR,
  }),
  null,
);

// ---------------------------------------------------------------------------

section('the settle velocity is clamped into what the panel can absorb');

check(
  'a fast positive flick is clamped',
  clampSettleVelocity(5000),
  MAX_SETTLE_VELOCITY,
);
check(
  'a fast negative flick is clamped',
  clampSettleVelocity(-5000),
  -MAX_SETTLE_VELOCITY,
);
check('a gentle flick passes through', clampSettleVelocity(120), 120);
check('zero stays zero', clampSettleVelocity(0), 0);

// ---------------------------------------------------------------------------

section('no import or missing directive can break this module');

ok(
  'swipe.ts declares no imports (the check transpiles it standalone)',
  !/^\s*import\b/m.test(source),
);

// Five helpers are called from gesture worklets. Strip the directive and the
// gesture throws on the UI thread at runtime — this repo has no device test, so
// the source is the only place to pin it. Comments are stripped first: the file
// header mentions 'worklet' in prose, so a naive count would pass even after a
// directive had been deleted — the exact false negative this guard exists to
// catch. Each helper is checked by name, not counted.
const codeOnly = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');
const WORKLET_HELPERS = [
  'settleTarget',
  'rubberband',
  'projectPosition',
  'resolveSwipeSide',
  'clampSettleVelocity',
];
for (const name of WORKLET_HELPERS) {
  ok(
    `${name} declares the worklet directive`,
    new RegExp(
      `function ${name}\\s*\\([^]*?\\)\\s*(?::[^{]+)?\\{\\s*'worklet';`,
    ).test(codeOnly),
  );
}

console.log(
  failures === 0
    ? '\nAll swipe checks passed.'
    : `\n${failures} swipe check(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
