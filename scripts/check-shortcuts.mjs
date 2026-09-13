/**
 * Standalone verification for the editor's keyboard-shortcut table.
 *
 * This repo has no test runner, so instead of adding one this script transpiles
 * `src/editor/shortcuts.ts` in memory with the installed TypeScript and asserts
 * the binding table and the key matcher. It needs no tsconfig, no `@/` alias
 * resolution and leaves nothing on disk.
 *
 * The matcher is the part worth pinning down: a wrong binding is silent, and
 * modifier mixes are exactly where "redo" quietly becomes "undo".
 *
 * Run: node scripts/check-shortcuts.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  join(here, "..", "src", "editor", "shortcuts.ts"),
  "utf8",
);

let failures = 0;

function pass(name) {
  console.log(`  PASS  ${name}`);
}

function fail(name, detail) {
  failures += 1;
  console.log(`  FAIL  ${name}`);
  if (detail !== undefined) {
    console.log(`        ${detail}`);
  }
}

function eq(name, got, expected) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(expected);
  if (a === b) {
    pass(name);
    return;
  }
  fail(name, `expected ${b}, got ${a}`);
}

/**
 * The table must stay dependency-free: this script evaluates the module on its
 * own, and the native stub imports it, so an import here would couple the
 * keymap to a platform.
 */
if (/^\s*import\s/m.test(source)) {
  fail("shortcuts.ts declares no imports", "found an import statement");
} else {
  pass("shortcuts.ts declares no imports");
}

const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});

const moduleShim = { exports: {} };
new Function("exports", "module", outputText)(moduleShim.exports, moduleShim);
const {
  SHORTCUT_BINDINGS,
  matchShortcut,
  formatChord,
  formatHint,
  chordFor,
  buildShortcutHints,
  NO_SHORTCUT_HINTS,
  NUDGE_COALESCE_MS,
  NUDGE_STEP,
  NUDGE_STEP_LARGE,
} = moduleShim.exports;

/** A key event with everything released. */
const ev = (over = {}) => ({
  key: "",
  code: "",
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  repeat: false,
  isComposing: false,
  ...over,
});

const idOf = (over) => matchShortcut(ev(over))?.id ?? null;

// ---------------------------------------------------------------------------
// Every action is bound, and one action can hold several bindings (Delete and
// Backspace, Ctrl+Shift+Z and Ctrl+Y).
// ---------------------------------------------------------------------------
const EXPECTED_IDS = [
  "delete",
  "undo",
  "redo",
  "duplicate",
  "selectAll",
  "save",
  "clearSelection",
  "nudgeLeft",
  "nudgeRight",
  "nudgeUp",
  "nudgeDown",
  "flipH",
  "flipV",
  "rotateCcw",
  "rotateCw",
  "bringToFront",
  "sendToBack",
  "toolSelect",
  "toolMultiSelect",
  "toolText",
  "toggleGrid",
];

const bound = new Set(SHORTCUT_BINDINGS.map((b) => b.id));
const unbound = EXPECTED_IDS.filter((id) => !bound.has(id));
eq("every action has at least one binding", unbound, []);
eq(
  "no binding names an unknown action",
  [...bound].filter((id) => !EXPECTED_IDS.includes(id)),
  [],
);
eq(
  "only Delete and Redo carry an alternate binding",
  [...bound].filter((id) => SHORTCUT_BINDINGS.filter((b) => b.id === id).length > 1),
  ["delete", "redo"],
);

// ---------------------------------------------------------------------------
// Conflicts: two bindings that would both claim one keystroke. The matcher
// returns the first hit, so a duplicate signature leaves the later one dead.
// ---------------------------------------------------------------------------
const signature = (b) => {
  const key = b.key !== undefined ? `key:${b.key}` : `code:${b.code}`;
  const mod = b.mod ? "mod" : "plain";
  const shift = b.shift === "any" ? "any" : String(!!b.shift);
  return `${key}|${mod}|${shift}`;
};

const seen = new Map();
const duplicates = [];
for (const binding of SHORTCUT_BINDINGS) {
  const sig = signature(binding);
  if (seen.has(sig)) {
    duplicates.push(`${sig} → ${seen.get(sig)} and ${binding.id}`);
  }
  seen.set(sig, binding.id);
}
eq("no two bindings share one keystroke", duplicates, []);

// A `shift: "any"` binding swallows every Shift variant of its key, so a
// specific Shift binding for the same key must be declared before it.
const shadowed = [];
for (const [i, binding] of SHORTCUT_BINDINGS.entries()) {
  if (binding.shift !== "any") {
    continue;
  }
  const later = SHORTCUT_BINDINGS.slice(i + 1).find(
    (b) => b.key === binding.key && b.code === binding.code,
  );
  if (later) {
    shadowed.push(`${binding.id} shadows ${later.id}`);
  }
}
eq("no shift-any binding shadows a later binding", shadowed, []);

// ---------------------------------------------------------------------------
// Resolution.
// ---------------------------------------------------------------------------
eq("Delete removes", idOf({ key: "Delete" }), "delete");
eq("Backspace removes", idOf({ key: "Backspace" }), "delete");
eq("Ctrl+Z undoes", idOf({ code: "KeyZ", key: "z", ctrlKey: true }), "undo");
eq("Cmd+Z undoes", idOf({ code: "KeyZ", key: "z", metaKey: true }), "undo");
eq(
  "Ctrl+Shift+Z redoes rather than undoing",
  idOf({ code: "KeyZ", key: "Z", ctrlKey: true, shiftKey: true }),
  "redo",
);
eq("Ctrl+Y redoes", idOf({ code: "KeyY", key: "y", ctrlKey: true }), "redo");
eq("Ctrl+D duplicates", idOf({ code: "KeyD", key: "d", ctrlKey: true }), "duplicate");
eq("Ctrl+A selects all", idOf({ code: "KeyA", key: "a", ctrlKey: true }), "selectAll");
eq("Ctrl+S saves", idOf({ code: "KeyS", key: "s", ctrlKey: true }), "save");
eq("Escape clears", idOf({ key: "Escape" }), "clearSelection");

eq("Left arrow nudges", idOf({ key: "ArrowLeft" }), "nudgeLeft");
eq("Shift+Left arrow nudges", idOf({ key: "ArrowLeft", shiftKey: true }), "nudgeLeft");
eq("Right arrow nudges", idOf({ key: "ArrowRight" }), "nudgeRight");
eq("Up arrow nudges", idOf({ key: "ArrowUp" }), "nudgeUp");
eq("Down arrow nudges", idOf({ key: "ArrowDown" }), "nudgeDown");

eq("Shift+H flips", idOf({ code: "KeyH", key: "H", shiftKey: true }), "flipH");
eq("Shift+V flips vertically", idOf({ code: "KeyV", key: "V", shiftKey: true }), "flipV");
eq("Shift+R rotates clockwise", idOf({ code: "KeyR", key: "R", shiftKey: true }), "rotateCw");
eq("Shift+E rotates counter-clockwise", idOf({ code: "KeyE", key: "E", shiftKey: true }), "rotateCcw");

eq("Ctrl+] raises", idOf({ code: "BracketRight", key: "]", ctrlKey: true }), "bringToFront");
eq("Ctrl+[ lowers", idOf({ code: "BracketLeft", key: "[", ctrlKey: true }), "sendToBack");

eq("V selects", idOf({ code: "KeyV", key: "v" }), "toolSelect");
eq("M toggles multi-select", idOf({ code: "KeyM", key: "m" }), "toolMultiSelect");
eq("T opens text", idOf({ code: "KeyT", key: "t" }), "toolText");
eq("G toggles the grid", idOf({ code: "KeyG", key: "g" }), "toggleGrid");

// ---------------------------------------------------------------------------
// Non-matches: the layer must stay inert for anything it does not own.
// ---------------------------------------------------------------------------
eq("a bare letter does not undo", idOf({ code: "KeyZ", key: "z" }), null);
eq(
  "Ctrl+Shift+V belongs to no binding",
  idOf({ code: "KeyV", key: "V", ctrlKey: true, shiftKey: true }),
  null,
);
eq(
  "AltGr (Ctrl+Alt) is left to the layout",
  idOf({ code: "KeyZ", key: "z", ctrlKey: true, altKey: true }),
  null,
);
eq(
  "an in-flight composition owns the key",
  idOf({ code: "KeyZ", key: "z", ctrlKey: true, isComposing: true }),
  null,
);
eq("an unknown key is ignored", idOf({ key: "F5" }), null);

// ---------------------------------------------------------------------------
// Auto-repeat: a held arrow is wanted, a held one-shot command is not.
// ---------------------------------------------------------------------------
eq(
  "a held arrow keeps nudging",
  idOf({ key: "ArrowRight", repeat: true }),
  "nudgeRight",
);
eq(
  "a held Ctrl+Z does not repeat",
  idOf({ code: "KeyZ", key: "z", ctrlKey: true, repeat: true }),
  null,
);

// ---------------------------------------------------------------------------
// Layout independence: letters match the physical key, so an Arabic layout —
// where that key produces "ر" instead of "v" — still reaches the action.
// ---------------------------------------------------------------------------
eq(
  "letters bind by physical key, not by produced character",
  idOf({ code: "KeyV", key: "ر" }),
  "toolSelect",
);

// ---------------------------------------------------------------------------
// Chord text.
// ---------------------------------------------------------------------------
const byId = (id) => SHORTCUT_BINDINGS.find((b) => b.id === id);
eq("mac undo chord", formatChord(byId("undo"), true), "⌘Z");
eq("windows undo chord", formatChord(byId("undo"), false), "Ctrl+Z");
eq("mac redo chord runs the modifiers together", formatChord(byId("redo"), true), "⇧⌘Z");
eq("windows redo chord spells them out", formatChord(byId("redo"), false), "Ctrl+Shift+Z");
eq("named keys read as words", formatChord(byId("delete"), true), "Delete");
eq("bare letters are shown alone", formatChord(byId("toolSelect"), true), "V");
eq("brackets survive the code lookup", formatChord(byId("bringToFront"), true), "⌘]");
eq("arrows read as glyphs", formatChord(byId("nudgeLeft"), true), "←");
eq("Shift alone still reads", formatChord(byId("flipH"), true), "⇧H");
eq("Shift alone on windows reads", formatChord(byId("flipH"), false), "Shift+H");

eq("a chord is appended to its label", formatHint("Undo", "⌘Z"), "Undo · ⌘Z");
eq("no chord leaves the label alone", formatHint("Undo", ""), "Undo");

eq("every action has a chord", EXPECTED_IDS.filter((id) => !chordFor(id, true)), []);

const hints = buildShortcutHints(true);
eq("the hint surface composes", hints.hint("Undo", "undo"), "Undo · ⌘Z");
eq("the inert surface adds nothing", NO_SHORTCUT_HINTS.hint("Undo", "undo"), "Undo");
eq("the inert surface shows no chord", NO_SHORTCUT_HINTS.chord("undo"), "");

// ---------------------------------------------------------------------------
// Store constants that the nudge path depends on.
// ---------------------------------------------------------------------------
eq("a nudge step is small", NUDGE_STEP, 1);
eq("a Shift nudge step is ten times as far", NUDGE_STEP_LARGE, 10);
eq(
  "the coalescing window is shorter than the gap between two deliberate presses",
  NUDGE_COALESCE_MS > 0 && NUDGE_COALESCE_MS < 500,
  true,
);

console.log(
  failures === 0
    ? `\nAll ${SHORTCUT_BINDINGS.length} shortcut bindings verified.`
    : `\n${failures} shortcut check(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
