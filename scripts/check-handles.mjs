/**
 * Standalone verification for selection-handle geometry.
 *
 * This repo has no test runner, so instead of adding one this script transpiles
 * `src/editor/hit-test.ts` in memory with the installed TypeScript and asserts
 * the invariants that make the handles grabbable on a touch screen. It needs no
 * tsconfig, no `@/` alias resolution and leaves nothing on disk — which is why
 * `hit-test.ts` may declare **only `import type`** (a value import would break
 * the transpile).
 *
 * The bug this locks down: every chrome constant and every touch radius used to
 * be a *design* unit, so on a phone (a 1080-unit canvas fits at a view scale of
 * ~0.3) the handles were drawn ~1.2pt off the box corner and the touch target
 * around them was ~7pt across. Web was fine only because the pointer is a mouse.
 * The assertions below are all stated in **screen pt**, so they fail if any part
 * of the chain stops dividing the view scale out.
 *
 * Run: node scripts/check-handles.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  join(here, '..', 'src', 'editor', 'hit-test.ts'),
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
  HANDLE_TOUCH_RADIUS,
  MEMBER_HIT_PAD,
  OBJECT_HIT_PAD,
  ROTATE_HANDLE_GAP,
  ROTATE_TOUCH_RADIUS,
  SELECTION_HANDLE_PAD,
  pickHandle,
  pickObject,
  resizeHandles,
  rotateHandle,
  safeObjectScale,
  safeUnit,
  selectionPad,
  toLocalPoint,
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

function near(a, b) {
  return Math.abs(a - b) < EPS;
}

/**
 * The view scales a real canvas is fitted at. `0.2` is a phone showing a wide
 * canvas, `4` is a large tablet on a small design — the sweep is deliberately
 * wider than reality so a scale-independent regression cannot hide in it.
 */
const UNITS = [0.2, 0.3, 0.5, 0.75, 1, 2, 4];

/** A canvas-sized box, so no two handles are anywhere near each other. */
const BIG_BOX = { width: 400, height: 300 };
/** A small box, where the touch radii overlap and the tiers decide. */
const SMALL_BOX = { width: 40, height: 40 };

const IDENTITY = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  flipH: false,
  flipV: false,
};

/** Local (frame) point → design point. The inverse of `toLocalPoint`. */
function localToDesign(t, local) {
  const rot = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const sx = (t.flipH ? -t.scale : t.scale) * local.x;
  const sy = (t.flipV ? -t.scale : t.scale) * local.y;
  return {
    x: t.x + sx * cos - sy * sin,
    y: t.y + sx * sin + sy * cos,
  };
}

// ---------------------------------------------------------------------------

section('chrome is authored in screen pt, not design units');

for (const unit of UNITS) {
  ok(
    `selectionPad(${unit}) is ${SELECTION_HANDLE_PAD}pt on screen`,
    near(selectionPad(unit) * unit, SELECTION_HANDLE_PAD),
  );
}

for (const unit of UNITS) {
  const grip = rotateHandle(BIG_BOX, unit);
  const aboveBoxEdge = -grip.y - BIG_BOX.height / 2;
  ok(
    `the rotate grip sits ${SELECTION_HANDLE_PAD + ROTATE_HANDLE_GAP}pt above the box at unit ${unit}`,
    near(aboveBoxEdge * unit, SELECTION_HANDLE_PAD + ROTATE_HANDLE_GAP),
  );
}

for (const unit of UNITS) {
  const offsets = resizeHandles(BIG_BOX, unit).map(
    (h) =>
      near((Math.abs(h.x) - BIG_BOX.width / 2) * unit, SELECTION_HANDLE_PAD) ||
      near((Math.abs(h.y) - BIG_BOX.height / 2) * unit, SELECTION_HANDLE_PAD),
  );
  ok(
    `every resize handle is ${SELECTION_HANDLE_PAD}pt off its box edge at unit ${unit}`,
    offsets.every(Boolean),
  );
}

// ---------------------------------------------------------------------------

section('what is drawn is what is grabbed');

for (const unit of UNITS) {
  const drawn = [
    ...resizeHandles(BIG_BOX, unit).map((h) => h.handle),
    'rotate',
  ];
  const hit = drawn.map((handle) => {
    const points = [
      ...resizeHandles(BIG_BOX, unit),
      ...(handle === 'rotate'
        ? [{ handle: 'rotate', ...rotateHandle(BIG_BOX, unit) }]
        : []),
    ];
    const point = points.find((p) => p.handle === handle);
    return pickHandle(IDENTITY, BIG_BOX, unit, { x: point.x, y: point.y });
  });
  check(`a press on each drawn handle grabs it (unit ${unit})`, hit, drawn);
}

// ---------------------------------------------------------------------------

section(
  `the 44pt touch floor holds at every zoom (${HANDLE_TOUCH_RADIUS * 2}pt targets)`,
);

for (const unit of UNITS) {
  const corners = resizeHandles(BIG_BOX, unit).filter((h) =>
    ['nw', 'ne', 'sw', 'se'].includes(h.handle),
  );
  const hit = corners.map((corner) => {
    // Step straight out along the diagonal, to the very edge of the target —
    // a corner is far from the grip and from every other handle on this box,
    // so the radius alone decides.
    const len = Math.hypot(corner.x, corner.y);
    const step = (HANDLE_TOUCH_RADIUS * 0.99) / unit;
    return pickHandle(IDENTITY, BIG_BOX, unit, {
      x: corner.x + (corner.x / len) * step,
      y: corner.y + (corner.y / len) * step,
    });
  });
  check(
    `a press ${HANDLE_TOUCH_RADIUS}pt outside a corner still resizes (unit ${unit})`,
    hit,
    corners.map((c) => c.handle),
  );
}

for (const unit of UNITS) {
  const grip = rotateHandle(BIG_BOX, unit);
  const inside = pickHandle(IDENTITY, BIG_BOX, unit, {
    x: grip.x,
    y: grip.y - (ROTATE_TOUCH_RADIUS * 0.9) / unit,
  });
  const beyond = pickHandle(IDENTITY, BIG_BOX, unit, {
    x: grip.x,
    y: grip.y - (ROTATE_TOUCH_RADIUS * 1.3) / unit,
  });
  check(
    `the rotate grip is grabbable ${ROTATE_TOUCH_RADIUS}pt out (unit ${unit})`,
    inside,
    'rotate',
  );
  check(
    `past the grip's radius nothing is grabbed (unit ${unit})`,
    beyond,
    null,
  );
}

// ---------------------------------------------------------------------------

section('the body of the object still moves');

for (const unit of UNITS) {
  check(
    `a press at the box centre is a move, not a resize (unit ${unit})`,
    pickHandle(IDENTITY, BIG_BOX, unit, { x: 0, y: 0 }),
    null,
  );
}

// 0.5 of the half-extent is inside the rim band (0.55), so the interior stays a
// move target even though the touch radius covers the whole of a small box.
check(
  'the interior of a box smaller than the touch radius is still a move',
  pickHandle(IDENTITY, SMALL_BOX, 0.3, { x: 0, y: 0 }),
  null,
);
check(
  'a press on a small box near its edge grabs a handle',
  typeof pickHandle(IDENTITY, SMALL_BOX, 0.3, { x: 19, y: 0 }) === 'string',
  true,
);

// ---------------------------------------------------------------------------

section('handle tiers: rotate > corner > edge');

// On the small box the corner, the near edge and the grip all overlap. The
// corner must win over the edge — otherwise a press on a short object's corner
// re-flows its text instead of scaling it.
check(
  'a corner beats an edge when both are in range',
  pickHandle(IDENTITY, SMALL_BOX, 1, { x: -20, y: -22 }),
  'nw',
);

// Halfway between the `ne` corner and the grip, both are in range.
check(
  'the rotate grip beats a resize handle when both are in range',
  pickHandle(IDENTITY, SMALL_BOX, 1, { x: 13, y: -41 }),
  'rotate',
);

// ---------------------------------------------------------------------------

section('the mapping holds through rotation, flip and object scale');

for (const transform of [
  { ...IDENTITY, x: 500, y: 400, scale: 2, rotation: 37 },
  { ...IDENTITY, x: 500, y: 400, scale: 0.4, rotation: -110 },
  { ...IDENTITY, x: 500, y: 400, scale: 1.5, rotation: 90, flipH: true },
  { ...IDENTITY, x: 500, y: 400, scale: 3, rotation: 12, flipV: true },
]) {
  const viewScale = 0.3;
  // For a single object the frame's `unit` is the view scale times the object's
  // own — the same conversion the overlay draws with.
  const unit = viewScale * safeObjectScale(transform.scale);
  const drawn = [
    ...resizeHandles(BIG_BOX, unit),
    { handle: 'rotate', ...rotateHandle(BIG_BOX, unit) },
  ];
  const expected = drawn.map((p) => p.handle);
  const got = drawn.map((p) =>
    pickHandle(transform, BIG_BOX, unit, localToDesign(transform, p)),
  );
  check(
    `every drawn handle is grabbable on a ${transform.rotation}° / ×${transform.scale} object (flipH ${transform.flipH}, flipV ${transform.flipV})`,
    got,
    expected,
  );
  // The local frame is scale-free, so the point must round-trip.
  const back = drawn.map((p) => {
    const design = localToDesign(transform, p);
    const local = toLocalPoint(transform, design.x, design.y);
    return near(local.x, p.x) && near(local.y, p.y);
  });
  ok(
    `local → design → local round-trips at ${transform.rotation}° / ×${transform.scale}`,
    back.every(Boolean),
  );
}

// ---------------------------------------------------------------------------

section('the object grab tolerance is a screen length too');

for (const unit of UNITS) {
  for (const scale of [0.25, 1, 4]) {
    const transform = { ...IDENTITY, scale };
    const box = BIG_BOX;
    // Both quantities in DESIGN units, which is the frame the press arrives in:
    // the box's edge is a local extent scaled up, and the tolerance is a screen
    // length divided by the view scale. `pickObject` performs the same
    // conversion, in the other direction.
    const edge = (box.width / 2) * scale;
    const pad = OBJECT_HIT_PAD / unit;
    const inside = edge + pad - 1e-3;
    const outside = edge + pad * 1.4;
    const obj = { id: 'a', transform, zIndex: 1, box };
    ok(
      `a press ${OBJECT_HIT_PAD}pt outside the edge still selects (unit ${unit}, ×${scale})`,
      pickObject([obj], inside, 0, unit)?.id === 'a',
    );
    ok(
      `twice that far does not (unit ${unit}, ×${scale})`,
      pickObject([obj], outside, 0, unit) === null,
    );
  }
}

// ---------------------------------------------------------------------------

section('a text part hit-tests against its tight ink box');

// A split part keeps an advance/line `box` for painting but carries an `ink`
// box — the glyph bounds — for hit-testing and chrome. Without it the part's hit
// box is wider than the letter, so adjacent parts' boxes overlap and a press
// grabs the wrong one.
const part = {
  id: 'p',
  transform: { ...IDENTITY },
  zIndex: 1,
  box: { width: 100, height: 50 },
  ink: { cx: 0, cy: 0, width: 20, height: 40 },
};
ok(
  'a press inside the ink box selects the part',
  pickObject([part], 8, 0, 1)?.id === 'p',
);
ok(
  'a press past the ink box but inside the advance box selects nothing',
  pickObject([part], 45, 0, 1) === null,
);
ok(
  'the grab tolerance grows the ink box',
  pickObject([part], 10 + MEMBER_HIT_PAD - 1, 0, 1)?.id === 'p',
);

const offsetPart = { ...part, ink: { cx: 30, cy: 0, width: 20, height: 40 } };
ok(
  'an ink centre offset moves the hit box with the glyphs',
  pickObject([offsetPart], 30, 0, 1)?.id === 'p',
);
ok(
  'the hit box follows the offset rather than staying at the origin',
  pickObject([offsetPart], -30, 0, 1) === null,
);

section(
  'an offset ink box moves the drawn handles and the grabbed ones together',
);
const inkOffset = { x: 25, y: 0 };
{
  const drawn = [
    ...resizeHandles(BIG_BOX, 1),
    { handle: 'rotate', ...rotateHandle(BIG_BOX, 1) },
  ];
  const got = drawn.map((p) =>
    pickHandle(
      IDENTITY,
      BIG_BOX,
      1,
      { x: p.x + inkOffset.x, y: p.y + inkOffset.y },
      inkOffset,
    ),
  );
  check(
    "an offset box's drawn handles are grabbable",
    got,
    drawn.map((p) => p.handle),
  );
}

// ---------------------------------------------------------------------------

section('the tighter member pad applies only to ink-hugging parts');

// A grouped object with no ink — a shape group, or grouped ordinary text — keeps
// the full object tolerance. Only a split word's ink part gets the tighter pad,
// so a neighbour cannot steal the press.
const groupedBox = {
  id: 'g',
  groupId: 'G',
  transform: { ...IDENTITY },
  zIndex: 1,
  box: BIG_BOX,
};
{
  const edge = BIG_BOX.width / 2;
  ok(
    'a grouped object without ink keeps the full grab tolerance',
    pickObject([groupedBox], edge + OBJECT_HIT_PAD * 0.9, 0, 1)?.id === 'g',
  );
}
{
  const edge = 20;
  const part = {
    id: 'p',
    groupId: 'G',
    transform: { ...IDENTITY },
    zIndex: 1,
    box: BIG_BOX,
    ink: { cx: 0, cy: 0, width: 40, height: 40 },
  };
  ok(
    'an ink part accepts a press inside its tighter tolerance',
    pickObject([part], edge + MEMBER_HIT_PAD - 2, 0, 1)?.id === 'p',
  );
  ok(
    'an ink part rejects a press beyond its tighter tolerance',
    pickObject([part], edge + MEMBER_HIT_PAD + 2, 0, 1) === null,
  );
}

// The ink offset must survive rotation and flip — the same mapping the frame and
// the handles use.
{
  const transform = { ...IDENTITY, x: 500, y: 400, scale: 2, rotation: 37 };
  const part = {
    id: 'p',
    transform,
    zIndex: 1,
    box: BIG_BOX,
    ink: { cx: 15, cy: -8, width: 40, height: 40 },
  };
  const rot = (transform.rotation * Math.PI) / 180;
  const s = transform.scale;
  const ox = s * (part.ink.cx * Math.cos(rot) - part.ink.cy * Math.sin(rot));
  const oy = s * (part.ink.cx * Math.sin(rot) + part.ink.cy * Math.cos(rot));
  ok(
    'the ink centre offset maps through rotation and scale',
    pickObject([part], transform.x + ox, transform.y + oy, 1)?.id === 'p',
  );
}

// ---------------------------------------------------------------------------

section('degenerate inputs cannot produce a division blow-up');

// `safeUnit` mirrors `safeObjectScale`: a genuinely unmeasured view reports
// `scale: 1`, and the guard has to read that as "1:1" rather than flooring it.
ok('an unmeasured view (0) reads as 1:1', safeUnit(0) === 1);
ok(
  'a near-zero unit floors instead of dividing by ~0',
  safeUnit(1e-9) > 0 && safeUnit(1e-9) < 1,
);
ok('a negative unit is treated as its magnitude', safeUnit(-0.3) === 0.3);
ok(
  'a zero-scaled object can still be grabbed by its edge handle',
  pickHandle({ ...IDENTITY, scale: 0 }, BIG_BOX, 0.3, {
    x: -BIG_BOX.width / 2 - selectionPad(0.3),
    y: 0,
  }) === 'w',
);

console.log(
  failures === 0
    ? '\nAll handle checks passed.'
    : `\n${failures} handle check(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
