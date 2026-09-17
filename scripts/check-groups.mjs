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
  dissolveSingletonGroups,
  expandToGroups,
  groupMemberIds,
  remapGroupIds,
  sameIds,
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

console.log(
  failures === 0
    ? `\nAll group checks passed.`
    : `\n${failures} group check(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
