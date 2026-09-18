/**
 * Runs the whole verification suite at once: the one command that answers "is
 * this tree OK?".
 *
 * It is exactly `yarn typecheck` + `yarn lint` + the four `check-*` scripts, run
 * together — the repo has no test runner, and running them one after another
 * charges the sum of their times to every edit. None of them share state, so
 * they run as sibling processes and the wall clock is the slowest task rather
 * than the total.
 *
 * Read-only by design: no task here writes, fixes or formats, so it is safe to
 * run at any point.
 *
 * Output is buffered per task and printed verbatim under a header once the task
 * exits — deliberately without a per-line prefix, so the `$tsc` and
 * `$eslint - stylish` problem matchers still match when this runs as a VS Code
 * task.
 *
 * `node_modules/.bin` shims are not used: spawning a `.cmd` on Windows requires
 * a shell, so every task is launched as `process.execPath` + the package's JS
 * entry point.
 *
 * Both slow tasks keep a repo-root cache, so a re-run only redoes what changed:
 * `tsconfig.tsbuildinfo` (from `"incremental": true`) and `.eslintcache`
 * (`--cache`). Delete them to force a cold run.
 *
 * Run: node scripts/verify.mjs [--serial]
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

/**
 * Read-only checks only — nothing here modifies the tree.
 */
const TASKS = [
  {
    id: "typecheck",
    command: [join(root, "node_modules/typescript/bin/tsc"), "--noEmit"],
  },
  {
    id: "lint",
    command: [
      join(root, "node_modules/eslint/bin/eslint.js"),
      "src",
      "scripts",
      "--cache",
      "--cache-location",
      ".eslintcache",
    ],
  },
  { id: "clusters", command: [join(here, "check-clusters.mjs")] },
  { id: "groups", command: [join(here, "check-groups.mjs")] },
  { id: "shortcuts", command: [join(here, "check-shortcuts.mjs")] },
  { id: "help", command: [join(here, "check-help.mjs")] },
];

const serial = process.argv.includes("--serial");

function elapsed(started) {
  return Number(process.hrtime.bigint() - started) / 1e6;
}

function run(task) {
  return new Promise((resolve) => {
    const started = process.hrtime.bigint();
    const child = spawn(process.execPath, task.command, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));

    const settle = (code) => {
      resolve({ ...task, code, output, ms: elapsed(started) });
    };

    child.on("error", (error) => {
      output += `${error.message}\n`;
      settle(1);
    });
    child.on("close", (code) => settle(code ?? 1));
  });
}

const started = process.hrtime.bigint();
const results = [];

if (serial) {
  for (const task of TASKS) {
    results.push(await run(task));
  }
} else {
  results.push(...(await Promise.all(TASKS.map(run))));
}

const total = elapsed(started);
const failed = results.filter((result) => result.code !== 0);

for (const result of results) {
  const state = result.code === 0 ? "PASS" : "FAIL";
  console.log(
    `\n=== ${result.id} - ${state} (${(result.ms / 1000).toFixed(1)}s) ===`,
  );
  const text = result.output.trimEnd();
  if (text) {
    console.log(text);
  }
}

console.log(
  `\n${results.length - failed.length}/${results.length} passed in ${(total / 1000).toFixed(1)}s`,
);
if (failed.length > 0) {
  console.log(`failed: ${failed.map((result) => result.id).join(", ")}`);
}

process.exit(failed.length === 0 ? 0 : 1);
