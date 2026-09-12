/**
 * Standalone verification for the shaping-aware cluster segmenter.
 *
 * This repo has no test runner, so instead of adding one this script transpiles
 * `src/editor/text/clusters.ts` in memory with the installed TypeScript and
 * asserts the segmentation of known words. It needs no tsconfig, no `@/` alias
 * resolution and leaves nothing on disk.
 *
 * Run: node scripts/check-clusters.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  join(here, "..", "src", "editor", "text", "clusters.ts"),
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
const { segmentClusters, canSplitIntoClusters } = moduleShim.exports;

/** @type {{name: string, text: string, expect: string[]}[]} */
const cases = [
  {
    name: "the reference word: م+د join, ر alone, س+ة join",
    text: "مدرسة",
    expect: ["مد", "ر", "سة"],
  },
  {
    name: "lam-alef forms a single connected ligature",
    text: "لا",
    expect: ["لا"],
  },
  {
    name: "a fully connected word stays whole",
    text: "كتب",
    expect: ["كتب"],
  },
  {
    name: "spaces separate clusters and are carried as gapBefore",
    text: "بسم الله",
    expect: ["بسم", "ا", "لله"],
  },
  {
    name: "harakat travel with the letter they decorate",
    text: "مَدْرَسَة",
    expect: ["مَدْ", "رَ", "سَة"],
  },
  {
    name: "tatweel is join-causing, so it merges its neighbours",
    text: "مـد",
    expect: ["مـد"],
  },
  {
    name: "ZWNJ forces a break",
    text: "م\u200cد",
    expect: ["م", "د"],
  },
  {
    name: "hamza never joins",
    text: "سمء",
    expect: ["سم", "ء"],
  },
  {
    name: "Latin has no joining, so letters split individually",
    text: "hello",
    expect: ["h", "e", "l", "l", "o"],
  },
  {
    name: "a combining mark stays with its base",
    text: "e\u0301x",
    expect: ["e\u0301", "x"],
  },
  {
    name: "digits are non-joining",
    text: "٢٠٢٦",
    expect: ["٢", "٠", "٢", "٦"],
  },
];

let failures = 0;

for (const { name, text, expect } of cases) {
  const got = segmentClusters(text).map((c) => c.text);
  const ok = got.length === expect.length && got.every((v, i) => v === expect[i]);
  if (ok) {
    console.log(`  PASS  ${name}`);
    continue;
  }
  failures += 1;
  console.log(`  FAIL  ${name}`);
  console.log(`        text     ${JSON.stringify(text)}`);
  console.log(`        expected ${JSON.stringify(expect)}`);
  console.log(`        got      ${JSON.stringify(got)}`);
}

// Rejoin must reproduce the source exactly, which is what makes the split
// reversible from the saved parts alone.
const roundTrip = ["مدرسة", "بسم الله", "مَدْرَسَة", "hello world", "كتب"];
for (const text of roundTrip) {
  const rebuilt = segmentClusters(text)
    .map((c) => c.gapBefore + c.text)
    .join("");
  if (rebuilt !== text) {
    failures += 1;
    console.log(`  FAIL  rejoin ${JSON.stringify(text)} → ${JSON.stringify(rebuilt)}`);
  } else {
    console.log(`  PASS  rejoin ${JSON.stringify(text)}`);
  }
}

// A single cluster (or none) must not offer a split.
const splitGuard = [
  ["كتب", false],
  ["لا", false],
  ["   ", false],
  ["مدرسة", true],
];
for (const [text, expected] of splitGuard) {
  const got = canSplitIntoClusters(text);
  if (got !== expected) {
    failures += 1;
    console.log(
      `  FAIL  canSplitIntoClusters(${JSON.stringify(text)}) = ${got}, expected ${expected}`,
    );
  } else {
    console.log(`  PASS  canSplitIntoClusters(${JSON.stringify(text)}) = ${got}`);
  }
}

console.log(
  failures === 0
    ? `\nAll cluster checks passed.`
    : `\n${failures} cluster check(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
