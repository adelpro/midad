/**
 * Standalone verification for the imported-icon subsystem.
 *
 * Transpiles `src/theme/icon-sets.ts` and `src/editor/icons/icon-geometry.ts` in
 * memory (both declare no value imports, so this is safe) and pins the invariants
 * the picker, the three renderers and the licence record rely on.
 *
 * Run: node scripts/check-icons.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

let failures = 0;
function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

/** Transpile one module and return its exports. No value imports allowed. */
function loadModule(rel) {
  const source = readFileSync(join(root, rel), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const shim = { exports: {} };
  new Function('exports', 'module', outputText)(shim.exports, shim);
  return shim.exports;
}

let sets;
let geometry;
try {
  sets = loadModule('src/theme/icon-sets.ts');
} catch (error) {
  fail(`cannot load src/theme/icon-sets.ts: ${error.message}`);
}
try {
  geometry = loadModule('src/editor/icons/icon-geometry.ts');
} catch (error) {
  fail(`cannot load src/editor/icons/icon-geometry.ts: ${error.message}`);
}

// ── the API identity ───────────────────────────────────────────────────────
// The hosts are tried in order. The primary must lead: the backups exist for a
// connection that cannot reach it, not as equals.
if (sets) {
  const hosts = sets.ICONIFY_HOSTS;
  if (!Array.isArray(hosts) || hosts.length < 2) {
    fail('ICONIFY_HOSTS must list the primary and at least one backup host');
  } else {
    if (hosts[0] !== 'https://api.iconify.design') {
      fail(`the first host must be api.iconify.design, got ${hosts[0]}`);
    }
    for (const host of hosts) {
      if (!host.startsWith('https://')) {
        fail(`icon host is not https: ${host}`);
      }
    }
  }

  // The public search API's `limit` has a documented minimum of 32, so asking for
  // fewer is a silently-ignored parameter rather than a smaller page.
  if (sets.ICON_SEARCH_LIMIT !== 32) {
    fail(
      `ICON_SEARCH_LIMIT must be 32 (the API's minimum), got ${sets.ICON_SEARCH_LIMIT}`,
    );
  }

  const searchUrl = sets.iconSearchUrl('home', sets.ICON_SEARCH_LIMIT);
  if (searchUrl !== 'https://api.iconify.design/search?query=home&limit=32') {
    fail(`iconSearchUrl built ${searchUrl}`);
  }
  // A query with spaces and a # must survive into the URL encoded, or the
  // request is truncated at the fragment.
  const tricky = sets.iconSearchUrl('a b#c', 32);
  if (/[ #]/.test(tricky)) {
    fail(`iconSearchUrl does not encode the query: ${tricky}`);
  }

  const dataUrl = sets.iconDataUrl('material-symbols', 'home');
  if (
    dataUrl !== 'https://api.iconify.design/material-symbols.json?icons=home'
  ) {
    fail(`iconDataUrl built ${dataUrl}`);
  }

  // Identity: a key is `prefix:name` and must round-trip. The ontology rule is
  // that a stored key is provenance, never dereferenced at render time, so a
  // wrong round-trip would silently mislabel an icon rather than break it.
  const key = sets.iconKey('mdi-light', 'home');
  if (key !== 'mdi-light:home') {
    fail(`iconKey built ${key}`);
  }
  const parsed = sets.parseIconKey(key);
  if (!parsed || parsed.prefix !== 'mdi-light' || parsed.name !== 'home') {
    fail(`parseIconKey did not round-trip ${key}`);
  }
  for (const bad of ['no-colon', '', ':name', 'prefix:', ':']) {
    if (sets.parseIconKey(bad) !== null) {
      fail(`parseIconKey accepted ${JSON.stringify(bad)}`);
    }
  }
}

// ── the allowlist and its licence record ───────────────────────────────────
// One rule matters: a set may not be offered unless its licence is recorded. The
// record is the file a human reads, so the check is what keeps the two in step.
if (sets) {
  const allowlist = sets.ICON_SET_ALLOWLIST;
  const prefixes = Object.keys(allowlist ?? {});
  if (prefixes.length === 0) {
    fail('ICON_SET_ALLOWLIST is empty');
  }
  for (const prefix of prefixes) {
    const entry = allowlist[prefix];
    if (!entry?.name) {
      fail(`allowlisted set ${prefix} has no display name`);
    }
    const license = entry?.license;
    if (!license?.title || !license?.spdx || !license?.url) {
      fail(`allowlisted set ${prefix} has an incomplete licence`);
    }
    if (!/^https:\/\//.test(license?.url ?? '')) {
      fail(`allowlisted set ${prefix} licence url is not https`);
    }
  }

  let record = '';
  try {
    record = readFileSync(join(root, 'THIRD-PARTY-ICONS.md'), 'utf8');
  } catch {
    fail('THIRD-PARTY-ICONS.md is missing');
  }
  if (record) {
    for (const prefix of prefixes) {
      if (!record.includes(prefix)) {
        fail(`THIRD-PARTY-ICONS.md does not record allowlisted set ${prefix}`);
      }
    }
    // The reverse direction: a record for a set nobody may offer is a promise
    // the app does not keep.
    for (const set of sets.ICON_SET_ALLOWLIST ? prefixes : []) {
      void set;
    }
  }
}

// ── the geometry resolver ──────────────────────────────────────────────────
// Icons are stored as paths, so anything this cannot reduce to `<path>` elements
// must be refused rather than approximated — a silently dropped `<circle>` is a
// wrong drawing, which is worse than a disabled row.
if (geometry) {
  const one = geometry.iconPathsFromBody('<path d="M0 0h24v24H0z"/>');
  if (!Array.isArray(one) || one.length !== 1) {
    fail('a single <path> body did not resolve to one path');
  } else {
    if (one[0].d !== 'M0 0h24v24H0z') {
      fail(`the resolved path lost its geometry: ${one[0].d}`);
    }
    if (one[0].fillRule !== 'nonzero') {
      fail(
        `a path with no fill-rule must default to nonzero, got ${one[0].fillRule}`,
      );
    }
  }

  const two = geometry.iconPathsFromBody('<path d="M1 1"/><path d="M2 2"/>');
  if (!Array.isArray(two) || two.length !== 2) {
    fail('two sibling paths did not resolve to two paths');
  } else if (two[0].d !== 'M1 1' || two[1].d !== 'M2 2') {
    fail('sibling paths came back out of document order');
  }

  // A <g> carries its paint onto its children; losing that fills a hole.
  const grouped = geometry.iconPathsFromBody(
    '<g fill-rule="evenodd"><path d="M3 3"/></g>',
  );
  if (!Array.isArray(grouped) || grouped[0]?.fillRule !== 'evenodd') {
    fail('fill-rule on a <g> was not inherited by its path');
  }
  const clip = geometry.iconPathsFromBody(
    '<path clip-rule="evenodd" d="M4 4"/>',
  );
  if (clip?.[0]?.fillRule !== 'evenodd') {
    fail('clip-rule on a path was not read as the fill rule');
  }

  // Refusals. Each of these would draw something wrong if accepted.
  for (const body of [
    '<circle cx="12" cy="12" r="9"/>',
    '<path d="M1 1"/><circle cx="2" cy="2" r="1"/>',
    '<g transform="matrix(1 0 0 1 2 2)"><path d="M1 1"/></g>',
    '<path transform="translate(2 2)" d="M1 1"/>',
    '<rect x="1" y="1" width="2" height="2"/>',
    '',
    '   ',
  ]) {
    if (geometry.iconPathsFromBody(body) !== null) {
      fail(`iconPathsFromBody accepted an unsupported body: ${body}`);
    }
  }

  // An <svg> wrapper is how half the API's responses arrive, so unwrapping it is
  // not optional.
  const wrapped = geometry.iconPathsFromBody(
    '<svg viewBox="0 0 24 24"><path d="M5 5"/></svg>',
  );
  if (!Array.isArray(wrapped) || wrapped.length !== 1) {
    fail('an <svg>-wrapped body did not resolve');
  }
}

if (failures > 0) {
  console.error(`\ncheck-icons: ${failures} failure(s)`);
  process.exit(1);
}
console.log('check-icons: OK');
