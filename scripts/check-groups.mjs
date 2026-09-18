/**
 * Standalone verification for group membership logic.
 *
 * This repo has no test runner, so instead of adding one this script transpiles
 * `src/editor/groups.ts` in memory with the installed TypeScript and asserts the
 * membership rules the editor's whole-groups invariant rests on. It needs no
 * tsconfig, no `@/` alias resolution and leaves nothing on disk.
 *
 * Run: node scripts/check-groups.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  join(here, "..", "src", "editor", "groups.ts"),
  "utf8",
);

const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});

const moduleShim = { exports: {} };
new Function("exports", "module", outputText)(moduleShim.exports, moduleShim);
const {
  canGroup,
  canUngroup,
  clampCollectionScale,
  collectionFrame,
  collectionMembers,
  dissolveSingletonGroups,
  enteredCollection,
  collectionBarPlacement,
  expandToGroups,
  flipCollection,
  frameBottomCentre,
  frameTopCentre,
  groupMemberIds,
  memberOrigins,
  remapGroupIds,
  rotateCollection,
  sameIds,
  scaleCollection,
  selectionCollection,
  selectionFrame,
  selectionUnits,
  unitCount,
} = moduleShim.exports;

/**
 * The fixture document. Two groups (G1 = b+c, G2 = e+f+g) and three lone
 * objects (a, d, plus zz which is deliberately absent below).
 */
const doc = [
  { id: "a" },
  { id: "b", groupId: "G1" },
  { id: "c", groupId: "G1" },
  { id: "d" },
  { id: "e", groupId: "G2" },
  { id: "f", groupId: "G2" },
  { id: "g", groupId: "G2" },
];

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

/** Round every number in a value, so trigonometry noise cannot fail a case. */
function roundDeep(value, digits = 6) {
  if (typeof value === "number") {
    return Number(value.toFixed(digits));
  }
  if (Array.isArray(value)) {
    return value.map((v) => roundDeep(v, digits));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, roundDeep(v, digits)]),
    );
  }
  return value;
}

/** `check` for geometry, where exact equality is not a fair test. */
function near(name, got, expected) {
  check(name, roundDeep(got), roundDeep(expected));
}

console.log("\nexpandToGroups — a selection is always whole groups");

check("a lone object is untouched", expandToGroups(["a"], doc), ["a"]);
check("an empty selection stays empty", expandToGroups([], doc), []);
check(
  "tapping a member leads with the tapped id, sibling follows in document order",
  expandToGroups(["b"], doc),
  ["b", "c"],
);
check(
  "the other member leads when it is the one tapped",
  expandToGroups(["c"], doc),
  ["c", "b"],
);
check(
  "a second unit is appended whole, with its own tapped id first",
  expandToGroups(["a", "e"], doc),
  ["a", "e", "f", "g"],
);
check(
  "a group tapped first keeps the selection order of the caller",
  expandToGroups(["e", "a"], doc),
  ["e", "f", "g", "a"],
);
check(
  "an already-whole group is not duplicated",
  expandToGroups(["b", "c"], doc),
  ["b", "c"],
);
check(
  "re-tapping a member of an expanded group changes nothing",
  expandToGroups(["b", "a", "c"], doc),
  ["b", "c", "a"],
);
check(
  "an id the document does not hold is kept as it was",
  expandToGroups(["zz"], doc),
  ["zz"],
);

// The invariant itself, over every starting selection the UI can produce: the
// result must contain each member's whole group.
const invariantInputs = [
  ["a"],
  ["b"],
  ["c"],
  ["d"],
  ["g"],
  ["a", "b"],
  ["a", "e"],
  ["b", "e", "d"],
  ["a", "b", "c", "d", "e", "f", "g"],
];
let invariantHolds = true;
for (const ids of invariantInputs) {
  const expanded = new Set(expandToGroups(ids, doc));
  for (const id of expanded) {
    const obj = doc.find((o) => o.id === id);
    if (obj?.groupId === undefined) {
      continue;
    }
    for (const memberId of groupMemberIds(doc, obj.groupId)) {
      if (!expanded.has(memberId)) {
        invariantHolds = false;
        console.log(
          `        leak: ${JSON.stringify(ids)} → ${JSON.stringify([...expanded])} misses ${memberId}`,
        );
      }
    }
  }
}
ok("every expanded selection is a union of whole groups", invariantHolds);

let idempotent = true;
for (const ids of invariantInputs) {
  const once = expandToGroups(ids, doc);
  const twice = expandToGroups(once, doc);
  if (!sameIds(once, twice)) {
    idempotent = false;
    console.log(
      `        leak: ${JSON.stringify(ids)} → ${JSON.stringify(once)} → ${JSON.stringify(twice)}`,
    );
  }
}
ok("expansion is idempotent", idempotent);

console.log("\nselectionUnits / unitCount — a group counts as one element");

check("a lone object is one unit", selectionUnits(["a"], doc), [["a"]]);
check("a group is one unit", selectionUnits(["b", "c"], doc), [["b", "c"]]);
check(
  "a three-member group is still one unit",
  selectionUnits(["e", "f", "g"], doc),
  [["e", "f", "g"]],
);
check(
  "units follow the selection's order",
  selectionUnits(["b", "c", "a"], doc),
  [["b", "c"], ["a"]],
);
check(
  "a group beside a lone object is two units",
  selectionUnits(["e", "f", "g", "d"], doc),
  [["e", "f", "g"], ["d"]],
);
check("a unit never names an unselected object", selectionUnits(["b"], doc), [
  ["b"],
]);
check("count of a group", unitCount(["b", "c"], doc), 1);
check(
  "count of a group beside a lone object",
  unitCount(["b", "c", "d"], doc),
  2,
);
check("count of an empty selection", unitCount([], doc), 0);

console.log("\ncanGroup — two or more elements, and no nesting");

check("two lone objects can be grouped", canGroup(["a", "d"], doc), true);
check("a lone object alone cannot", canGroup(["a"], doc), false);
check("an empty selection cannot", canGroup([], doc), false);
check(
  "a lone object plus a group cannot (no nesting)",
  canGroup(["a", "b"], doc),
  false,
);
check(
  "an existing group cannot be grouped again",
  canGroup(["b", "c"], doc),
  false,
);
check("an unknown id blocks grouping", canGroup(["a", "zz"], doc), false);

console.log("\ncanUngroup — exactly one whole group");

check("a whole group can be ungrouped", canUngroup(["b", "c"], doc), true);
check(
  "a three-member group can be ungrouped",
  canUngroup(["e", "f", "g"], doc),
  true,
);
check("one member alone cannot", canUngroup(["b"], doc), false);
check(
  "a group plus a lone object cannot",
  canUngroup(["b", "c", "a"], doc),
  false,
);
check("two groups cannot", canUngroup(["b", "c", "e", "f", "g"], doc), false);
check(
  "an unknown id blocks ungrouping",
  canUngroup(["b", "c", "zz"], doc),
  false,
);

console.log("\ndissolveSingletonGroups — a one-member group is not a group");

ok(
  "a document with no singletons keeps its array identity",
  dissolveSingletonGroups(doc) === doc,
);

const singletonDoc = [
  { id: "a", groupId: "G1" },
  { id: "b" },
  { id: "c", groupId: "G2" },
  { id: "d", groupId: "G2" },
];
const dissolved = dissolveSingletonGroups(singletonDoc);
check(
  "the lone member loses its membership",
  dissolved.map((o) => o.groupId ?? null),
  [null, null, "G2", "G2"],
);
ok("an untouched object keeps its identity", dissolved[1] === singletonDoc[1]);
ok(
  "a surviving group member keeps its identity",
  dissolved[2] === singletonDoc[2],
);

console.log("\nremapGroupIds — a duplicate becomes its own group");

check(
  "a copied group shares one fresh id",
  remapGroupIds(
    [
      { id: "b1", groupId: "G1" },
      { id: "c1", groupId: "G1" },
    ],
    "NEW",
  ).map((o) => o.groupId),
  ["NEW", "NEW"],
);
check(
  "a copied lone object stays lone",
  remapGroupIds([{ id: "a1" }], "NEW").map((o) => o.groupId ?? null),
  [null],
);
check(
  "a copy of a single group member dissolves back to standalone",
  remapGroupIds([{ id: "b1", groupId: "G1" }], "NEW").map(
    (o) => o.groupId ?? null,
  ),
  [null],
);
check(
  "the source's membership is never shared with the copy",
  remapGroupIds(
    [
      { id: "b1", groupId: "G1" },
      { id: "c1", groupId: "G1" },
    ],
    "NEW",
  ).some((o) => o.groupId === "G1"),
  false,
);

console.log("\nsameIds");

check("equal lists", sameIds(["a", "b"], ["a", "b"]), true);
check("different order", sameIds(["b", "a"], ["a", "b"]), false);
check("different length", sameIds(["a"], ["a", "b"]), false);
check("both empty", sameIds([], []), true);

// ---------------------------------------------------------------------------
// The collection: which objects one selection is made of, the box around them,
// and the per-member transform a handle drag writes.
// ---------------------------------------------------------------------------

console.log("\nselectionCollection / enteredCollection — the two states");

check(
  "a whole group is one collection",
  selectionCollection(["b", "c"], doc),
  "G1",
);
check(
  "an entered member is still that collection",
  selectionCollection(["b"], doc),
  "G1",
);
check(
  "a lone object is not a collection",
  selectionCollection(["a"], doc),
  null,
);
check(
  "a group beside a lone object is not one collection",
  selectionCollection(["b", "c", "a"], doc),
  null,
);
check(
  "two groups are not one collection",
  selectionCollection(["b", "c", "e"], doc),
  null,
);
check(
  "an empty selection is not a collection",
  selectionCollection([], doc),
  null,
);

check(
  "an entered member names its collection",
  enteredCollection(["c"], doc),
  "G1",
);
check("a whole group is not entered", enteredCollection(["b", "c"], doc), null);
check("a lone object is not entered", enteredCollection(["a"], doc), null);
check("an empty selection is not entered", enteredCollection([], doc), null);

console.log(
  "\ncollectionMembers — reading order for a word, document order otherwise",
);

const wordDoc = [
  { id: "w1", groupId: "W", part: { index: 1 } },
  { id: "loose" },
  { id: "w0", groupId: "W", part: { index: 0 } },
  { id: "w2", groupId: "W", part: { index: 2 } },
];
check(
  "a split word is read in index order",
  collectionMembers(["w1"], wordDoc).map((m) => m.id),
  ["w0", "w1", "w2"],
);
check(
  "a whole group keeps document order",
  collectionMembers(["b", "c"], doc).map((m) => m.id),
  ["b", "c"],
);
check("a loose object has no members", collectionMembers(["a"], doc), []);

console.log("\ncollectionFrame — the box the handles are drawn on");

const frameMember = (id, x, y, rotation = 0, scale = 1) => ({
  id,
  transform: { x, y, scale, rotation, flipH: false, flipV: false },
  box: { width: 100, height: 50 },
});

check("an empty collection has no frame", collectionFrame([]), null);
near(
  "one member's frame is its own box",
  collectionFrame([frameMember("a", 0, 0)]),
  { x: 0, y: 0, hw: 50, hh: 25, rotation: 0 },
);
near(
  "two members union in design space when their rotations agree",
  collectionFrame([frameMember("a", 0, 0), frameMember("b", 200, 0)]),
  { x: 100, y: 0, hw: 150, hh: 25, rotation: 0 },
);
// Both members turned 90°: the arrangement now stands vertically, so the frame
// turns with it rather than growing into a rotation-widened union.
near(
  "a unanimously rotated collection gets an oriented frame",
  collectionFrame([frameMember("a", 0, 0, 90), frameMember("b", 200, 0, 90)]),
  { x: 100, y: 0, hw: 50, hh: 125, rotation: 90 },
);
// Mixed rotations have no honest orientation, so the box is the axis-aligned
// union of the rotation-widened boxes and the rotation reads 0. Member `b`
// turned a quarter turn is 50 wide and 100 tall, so it reaches 225.
near(
  "mixed rotations fall back to the axis-aligned union",
  collectionFrame([frameMember("a", 0, 0, 0), frameMember("b", 200, 0, 90)]),
  { x: 87.5, y: 0, hw: 137.5, hh: 50, rotation: 0 },
);
near(
  "a scaled member contributes its visual box",
  collectionFrame([frameMember("a", 0, 0, 0, 2)]),
  { x: 0, y: 0, hw: 100, hh: 50, rotation: 0 },
);
near(
  "the bar anchors on the frame's top edge",
  frameTopCentre({ x: 100, y: 0, hw: 150, hh: 25, rotation: 0 }),
  { x: 100, y: -25 },
);
near(
  "the top edge follows the frame's rotation",
  frameTopCentre({ x: 100, y: 0, hw: 50, hh: 125, rotation: 90 }),
  { x: 225, y: 0 },
);
near(
  "the bottom edge is the top edge through the frame",
  frameBottomCentre({ x: 100, y: 0, hw: 150, hh: 25, rotation: 0 }),
  { x: 100, y: 25 },
);
near(
  "the bottom edge follows the frame's rotation too",
  frameBottomCentre({ x: 100, y: 0, hw: 50, hh: 125, rotation: 90 }),
  { x: -25, y: 0 },
);

console.log("\ncollectionBarPlacement — clear of the frame, or clamped");

/** A 200×44 bar anchored to a frame whose top edge is at `topY`. */
function barAt({ topY, bottomY = topY + 100, barWidth = 200, view = {} }) {
  return collectionBarPlacement({
    topAnchor: { x: 200, y: topY },
    bottomAnchor: { x: 200, y: bottomY },
    barWidth,
    barHeight: 44,
    viewW: view.w ?? 400,
    viewH: view.h ?? 600,
    margin: 4,
    gap: 8,
  });
}

// The common case: room above, so the bar sits over the frame's top edge and
// covers nothing. left = 200 - 100 = 100.
check("a clear frame puts the bar above it", barAt({ topY: 200 }), {
  left: 100,
  top: 148,
  side: "above",
});

// The flip: 44 + 8 of clearance no longer fits above (200 -> 148 cleared, 20
// does not), so the bar drops below the frame's bottom edge instead.
check("a frame at the top edge flips the bar below it", barAt({ topY: 20 }), {
  left: 100,
  top: 128,
  side: "below",
});

// Neither side fits: a selection taller than the canvas clamps above the frame
// rather than rendering off-screen.
check(
  "a frame taller than the canvas clamps the bar",
  barAt({ topY: -300, bottomY: 700 }),
  {
    left: 100,
    top: 4,
    side: "above",
  },
);

// The left clamp, both edges, and the mirroring case that a rotated frame
// produces: an anchor off the canvas still yields an on-canvas bar.
check(
  "the bar clamps to the left edge",
  barAt({ topY: 200, barWidth: 0 }).left,
  200,
);
check(
  "an anchor past the left edge clamps to the margin",
  collectionBarPlacement({
    topAnchor: { x: -50, y: 200 },
    bottomAnchor: { x: -50, y: 300 },
    barWidth: 200,
    barHeight: 44,
    viewW: 400,
    viewH: 600,
    margin: 4,
    gap: 8,
  }).left,
  4,
);
check(
  "an anchor past the right edge clamps to the far margin",
  collectionBarPlacement({
    topAnchor: { x: 900, y: 200 },
    bottomAnchor: { x: 900, y: 300 },
    barWidth: 200,
    barHeight: 44,
    viewW: 400,
    viewH: 600,
    margin: 4,
    gap: 8,
  }).left,
  196,
);
check(
  "a bar wider than the canvas collapses to the margin, not a negative range",
  collectionBarPlacement({
    topAnchor: { x: 200, y: 200 },
    bottomAnchor: { x: 200, y: 300 },
    barWidth: 500,
    barHeight: 44,
    viewW: 400,
    viewH: 600,
    margin: 4,
    gap: 8,
  }).left,
  4,
);

console.log(
  "\nscaleCollection / rotateCollection — handles move the whole set",
);

const origins = memberOrigins([
  frameMember("a", 0, 0),
  frameMember("b", 200, 0),
]);
check("memberOrigins captures the transform", origins[1], {
  id: "b",
  x: 200,
  y: 0,
  scale: 1,
  rotation: 0,
  flipH: false,
  flipV: false,
});

const scaled = scaleCollection(
  origins,
  2,
  { x: 100, y: 0 },
  { min: 0.05, max: 20 },
);
check(
  "scaling doubles every offset from the pivot",
  scaled.map((p) => [p.id, p.transform.x, p.transform.scale]),
  [
    ["a", -100, 2],
    ["b", 300, 2],
  ],
);
check(
  "a member sitting on the pivot does not move",
  scaleCollection(
    memberOrigins([frameMember("a", 100, 0)]),
    3,
    { x: 100, y: 0 },
    { min: 0.05, max: 20 },
  )[0].transform.x,
  100,
);
check(
  "the factor is clamped so no member leaves the bounds",
  clampCollectionScale(origins, 2, { min: 0.05, max: 20 }),
  2,
);
const nearMax = memberOrigins([frameMember("a", 0, 0, 0, 15)]);
check(
  "a member already near the ceiling caps the factor",
  Number(clampCollectionScale(nearMax, 2, { min: 0.05, max: 20 }).toFixed(4)),
  1.3333,
);
check(
  "the clamped factor keeps the member inside the bounds",
  scaleCollection(nearMax, 2, { x: 0, y: 0 }, { min: 0.05, max: 20 })[0]
    .transform.scale,
  20,
);
ok(
  "a span wider than the bounds falls back rather than inventing a factor",
  clampCollectionScale(
    // Scales a single-object resize could never produce, but an imported
    // document can: the span exceeds MAX/MIN, so no single factor exists.
    memberOrigins([
      frameMember("a", 0, 0, 0, 0.001),
      frameMember("b", 0, 0, 0, 100),
    ]),
    2,
    { min: 0.05, max: 20 },
  ) === 2,
);

const turned = rotateCollection(origins, 90, { x: 100, y: 0 });
check(
  "rotating orbits each member about the pivot and turns it",
  turned.map((p) => [p.id, p.transform.x, p.transform.y, p.transform.rotation]),
  [
    ["a", 100, -100, 90],
    ["b", 100, 100, 90],
  ],
);
check(
  "a half turn mirrors both offsets",
  rotateCollection(origins, 180, { x: 100, y: 0 }).map((p) => [
    p.id,
    Math.round(p.transform.x),
    Math.round(p.transform.y),
  ]),
  [
    ["a", 200, 0],
    ["b", 0, 0],
  ],
);
check(
  "rotating by nothing changes nothing",
  rotateCollection(origins, 0, { x: 100, y: 0 }).map((p) => p.transform.x),
  [0, 200],
);

console.log(
  "\nflipCollection — a mirror moves the arrangement, not just the letters",
);

const mirrored = flipCollection(origins, "h", { x: 100, y: 0 });
check(
  "offsets mirror about the pivot",
  mirrored.map((p) => [p.id, p.transform.x, p.transform.y]),
  [
    ["a", 200, 0],
    ["b", 0, 0],
  ],
);
check(
  "each member turns to face the other way",
  mirrored.map((p) => [p.transform.rotation, p.transform.flipH]),
  [
    [0, true],
    [0, true],
  ],
);
check(
  "a mirrored member's angle negates",
  flipCollection(
    memberOrigins([frameMember("a", 0, 0, 30), frameMember("b", 200, 0, 30)]),
    "h",
    { x: 100, y: 0 },
  ).map((p) => p.transform.rotation),
  [-30, -30],
);
check(
  "a vertical mirror flips the other axis and keeps x",
  flipCollection(origins, "v", { x: 100, y: 0 }).map((p) => [
    p.transform.x,
    p.transform.flipV,
  ]),
  [
    [0, true],
    [200, true],
  ],
);
check(
  "a vertical mirror mirrors y about the pivot",
  flipCollection(memberOrigins([frameMember("a", 0, 40)]), "v", {
    x: 0,
    y: 0,
  })[0].transform.y,
  -40,
);

console.log("\nselectionFrame — one box for the canvas, the bar and the press");

const sizedMember = (id, groupId, x, y) => ({
  id,
  groupId,
  transform: { x, y, scale: 1, rotation: 0, flipH: false, flipV: false },
  box: { width: 100, height: 50 },
});

check(
  "one loose object has no frame of its own",
  selectionFrame(["a"], [sizedMember("a", undefined, 0, 0)]),
  null,
);
const loosePair = selectionFrame(
  ["a", "b"],
  [sizedMember("a", undefined, 0, 0), sizedMember("b", undefined, 200, 0)],
);
check("a loose multi-selection is whole", loosePair.state, "whole");
near("its frame is the selection's own box", loosePair.frame.hw, 150);
const insideGroup = selectionFrame(
  ["a"],
  [sizedMember("a", "G", 0, 0), sizedMember("b", "G", 200, 0)],
);
check("one member of a collection is entered", insideGroup.state, "entered");
near("its frame is the whole collection's box", insideGroup.frame.hw, 150);
check("and it carries every member", insideGroup.members.length, 2);
const wholeGroup = selectionFrame(
  ["a", "b"],
  [sizedMember("a", "G", 0, 0), sizedMember("b", "G", 200, 0)],
);
check("a whole collection is whole", wholeGroup.state, "whole");
check(
  "a selection that is not a collection still gets one box",
  selectionFrame(
    ["a", "b", "c"],
    [
      sizedMember("a", "G1", 0, 0),
      sizedMember("b", "G1", 200, 0),
      sizedMember("c", undefined, 400, 0),
    ],
  ).state,
  "whole",
);

console.log(
  failures === 0
    ? `\nAll group checks passed.`
    : `\n${failures} group check(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
