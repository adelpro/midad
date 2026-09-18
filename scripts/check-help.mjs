/**
 * Standalone verification for the editor's help table.
 *
 * `src/editor/help/catalog.ts` is the single source behind every tooltip, the
 * learn-mode banner and the help sheet, so a gap in it is a control the user
 * can never have explained. Three things go wrong quietly and are worth
 * pinning down:
 *
 * - a `hints` key that no entry claims (a tooltip that exists but is not in the
 *   reference), or an entry pointing at a key that does not exist;
 * - a role that is a copy of its own label, which reads as documentation but
 *   says nothing;
 * - an action in the shortcut table that no entry mentions, so the sheet claims
 *   to be complete while hiding it.
 *
 * Like `check-shortcuts.mjs`, this transpiles the modules in memory with the
 * installed TypeScript rather than adding a test runner. The catalog declares
 * only `import type`, which `transpileModule` erases, so it evaluates with no
 * `@/` alias resolution and leaves nothing on disk.
 *
 * Run: node scripts/check-help.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');

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

function ok(name, condition, detail) {
  if (condition) {
    pass(name);
    return;
  }
  fail(name, detail);
}

/** Evaluate a module's transpiled CommonJS output. */
function load(...parts) {
  const source = read(...parts);
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const moduleShim = { exports: {} };
  new Function('exports', 'module', outputText)(moduleShim.exports, moduleShim);
  return { source, exports: moduleShim.exports };
}

// ---------------------------------------------------------------------------
// Every module here has to stand alone: the native bundles import the catalog
// and the binding table, so neither may reach a platform or a DOM type.
// ---------------------------------------------------------------------------
const catalog = load('src', 'editor', 'help', 'catalog.ts');
const stringsModule = load('src', 'i18n', 'strings.ts');
const shortcutModule = load('src', 'editor', 'shortcuts.ts');

ok(
  'catalog.ts declares no runtime imports',
  !/^\s*import\s+(?!type\b)/m.test(catalog.source),
  'found a value import; only `import type` is allowed',
);
ok(
  'strings.ts declares no imports',
  !/^\s*import\s/m.test(stringsModule.source),
  'found an import statement',
);

const { HELP_ENTRIES, HELP_GROUPS } = catalog.exports;
const { strings } = stringsModule.exports;
const { SHORTCUT_BINDINGS } = shortcutModule.exports;

const LANGUAGES = ['ar', 'en'];

/**
 * `partLabel` is a format template ("Part {n} of {total}"), not the label of a
 * control, so no entry can claim it. Listed rather than pattern-matched so
 * adding a real label key later cannot slip past unnoticed.
 */
const NON_LABEL_HINTS = ['partLabel', 'memberLabel'];

// ---------------------------------------------------------------------------
// Shape.
// ---------------------------------------------------------------------------
const keys = HELP_ENTRIES.map((entry) => entry.key);
eq(
  'every help key is unique',
  keys.filter((key, i) => keys.indexOf(key) !== i),
  [],
);
eq(
  'no help key is blank',
  keys.filter((key) => typeof key !== 'string' || key.trim() === ''),
  [],
);

const groupKeys = HELP_GROUPS.map((group) => group.key);
ok(
  'every group is declared before it is used',
  HELP_ENTRIES.every((entry) => groupKeys.includes(entry.group)),
  'an entry names a group that HELP_GROUPS does not declare',
);

const declaredLabelForms = ['hint', 'editor', 'ar'];
const malformed = HELP_ENTRIES.filter((entry) => {
  const found = Object.keys(entry.label ?? {}).filter((key) =>
    declaredLabelForms.includes(key),
  );
  // `ar` and `en` are one form, and the other two are one key each: either
  // exactly `ar`+`en`, or exactly one of the namespaces.
  const forms = found.includes('ar')
    ? found.includes('en')
      ? ['literal']
      : ['literal-incomplete']
    : found;
  return forms.length !== 1;
}).map((entry) => entry.key);
eq('every label uses exactly one source', malformed, []);

const labelForms = HELP_ENTRIES.map((entry) =>
  'hint' in entry.label
    ? `hint:${entry.label.hint}`
    : 'editor' in entry.label
      ? `editor:${entry.label.editor}`
      : 'literal',
);
const hintKeys = labelForms
  .filter((form) => form.startsWith('hint:'))
  .map((form) => form.slice('hint:'.length));
const editorKeys = labelForms
  .filter((form) => form.startsWith('editor:'))
  .map((form) => form.slice('editor:'.length));

// ---------------------------------------------------------------------------
// Labels resolve in both languages.
// ---------------------------------------------------------------------------
const missingLabels = [];
for (const language of LANGUAGES) {
  const hints = strings[language].editor.hints;
  for (const key of hintKeys) {
    if (typeof hints[key] !== 'string' || hints[key] === '') {
      missingLabels.push(`${language}: hints.${key}`);
    }
  }
  for (const key of editorKeys) {
    const value = strings[language].editor[key];
    if (typeof value !== 'string' || value === '') {
      missingLabels.push(`${language}: editor.${key}`);
    }
  }
}
eq('every referenced label exists in both languages', missingLabels, []);

const literalGaps = HELP_ENTRIES.filter(
  (entry) =>
    'ar' in entry.label &&
    (typeof entry.label.ar !== 'string' ||
      entry.label.ar.trim() === '' ||
      typeof entry.label.en !== 'string' ||
      entry.label.en.trim() === ''),
).map((entry) => entry.key);
eq('every literal label is written in both languages', literalGaps, []);

// ---------------------------------------------------------------------------
// Every hints key is accounted for. This is the assertion that keeps the
// help sheet from silently going stale as controls are added.
// ---------------------------------------------------------------------------
const hintsKeys = Object.keys(strings.en.editor.hints);
const unclaimed = hintsKeys.filter(
  (key) => !hintKeys.includes(key) && !NON_LABEL_HINTS.includes(key),
);
eq('every tooltip label belongs to exactly one help entry', unclaimed, []);

eq(
  'a hints key is never claimed twice',
  hintKeys.filter((key, i) => hintKeys.indexOf(key) !== i),
  [],
);

eq(
  'the hints allowlist holds only non-labels',
  NON_LABEL_HINTS.filter((key) => !(key in strings.en.editor.hints)),
  [],
);

// ---------------------------------------------------------------------------
// Roles say something. A role that repeats its own label is the failure mode
// this table exists to avoid.
// ---------------------------------------------------------------------------
const resolveLabel = (entry, language) => {
  if ('hint' in entry.label) {
    return strings[language].editor.hints[entry.label.hint];
  }
  if ('editor' in entry.label) {
    return strings[language].editor[entry.label.editor];
  }
  return entry.label[language];
};

const roleProblems = [];
for (const entry of HELP_ENTRIES) {
  for (const language of LANGUAGES) {
    const role = language === 'ar' ? entry.roleAr : entry.roleEn;
    if (typeof role !== 'string' || role.trim() === '') {
      roleProblems.push(`${entry.key}: empty ${language} role`);
      continue;
    }
    if (role.trim() === resolveLabel(entry, language).trim()) {
      roleProblems.push(`${entry.key}: ${language} role repeats its label`);
    }
  }
}
eq('every role explains rather than repeats', roleProblems, []);

// ---------------------------------------------------------------------------
// Shortcuts: the sheet claims to list them all, so every bound action has to
// appear, and nothing may point at an action that does not exist.
// ---------------------------------------------------------------------------
const boundIds = [...new Set(SHORTCUT_BINDINGS.map((binding) => binding.id))];
const claimedIds = HELP_ENTRIES.map((entry) => entry.shortcutId).filter(
  Boolean,
);

eq(
  'no entry names an unknown shortcut',
  claimedIds.filter((id) => !boundIds.includes(id)),
  [],
);
eq(
  'every shortcut is documented',
  boundIds.filter((id) => !claimedIds.includes(id)),
  [],
);

// ---------------------------------------------------------------------------
// No empty sections in the sheet.
// ---------------------------------------------------------------------------
eq(
  'no help group is empty',
  groupKeys.filter((key) => !HELP_ENTRIES.some((entry) => entry.group === key)),
  [],
);

// ---------------------------------------------------------------------------
// A chord is only mentioned where a key can be pressed. The native hint surface
// returns "", which is the behaviour `check-shortcuts.mjs` pins down; what
// matters here is that the catalog never hardcodes chord text of its own.
// ---------------------------------------------------------------------------
const hardcodedChords = HELP_ENTRIES.filter((entry) =>
  ['ar', 'en'].some((language) =>
    /(⌘|⇧|Ctrl\+|Shift\+)/.test(
      language === 'ar' ? entry.roleAr : entry.roleEn,
    ),
  ),
).map((entry) => entry.key);
eq('no role hardcodes a chord', hardcodedChords, []);

console.log(
  failures === 0
    ? `\nAll ${HELP_ENTRIES.length} help entries verified across ${groupKeys.length} groups.`
    : `\n${failures} help check(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
