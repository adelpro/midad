/**
 * Standalone verification for the placed-asset storage layer.
 *
 * Transpiles `src/storage/design-file.ts` and `src/storage/project-schema.ts` in
 * memory (the same technique `check-icons.mjs` uses) and pins the container, the
 * version reader and the asset-naming contract.
 *
 * **Why this exists.** The 0.6.0 whole-branch review found three data-loss bugs
 * that `verify` could not see, because none of this was executable: the platform
 * store wrote an archive path (`assets/<id>.<ext>`) to a device filesystem that
 * has no `assets/` directory, and import/duplicate discarded every placed image's
 * bytes. All three were green in `tsc` and green in `verify`. The naming
 * invariant below is the one that encodes the difference, and the copy helper is
 * what both repair paths now share.
 *
 * Run: node scripts/check-storage.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

let failures = 0;
function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function transpile(rel) {
  return ts.transpileModule(readFileSync(join(root, rel), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

/** Load a repo module through data: URLs, rewriting its two imports. */
async function loadModule(rel, rewrites) {
  let code = transpile(rel);
  for (const [from, to] of Object.entries(rewrites)) {
    code = code.replaceAll(from, to);
  }
  return import(`data:text/javascript,${encodeURIComponent(code)}`);
}

const fflatePath = pathToFileURL(
  join(root, 'node_modules/fflate/esm/browser.js'),
).href;
const fflateUrl =
  'data:text/javascript,' +
  encodeURIComponent(`export * from '${fflatePath}';`);
const schemaUrl =
  'data:text/javascript,' +
  encodeURIComponent(transpile('src/storage/project-schema.ts'));

let designFile;
let schema;
try {
  schema = await loadModule('src/storage/project-schema.ts', {});
  designFile = await loadModule('src/storage/design-file.ts', {
    "from 'fflate'": `from "${fflateUrl}"`,
    "from '@/storage/project-schema'": `from "${schemaUrl}"`,
  });
} catch (error) {
  fail(`cannot load the storage modules: ${error.message}`);
}

// ── the two names must not be the same name ────────────────────────────────
// An archive entry lives inside a ZIP; a device file lives in a flat project
// directory. C1 was exactly this confusion: the device store was handed the
// archive path and asked the filesystem to create `assets/`, which does not
// exist. The assertion is on the *platform* source because the naming function
// is private to it.
if (designFile) {
  if (designFile.assetEntryName('i_1', 'image/jpeg') !== 'assets/i_1.jpg') {
    fail(
      `assetEntryName must stay the archive path, got ${designFile.assetEntryName('i_1', 'image/jpeg')}`,
    );
  }
  if (designFile.extensionForMime('image/png') !== 'png') {
    fail('extensionForMime does not map image/png');
  }
  if (designFile.extensionForMime('application/x-nonsense') !== 'jpg') {
    fail('extensionForMime must fall back to jpg');
  }
}

const nativeSource = readFileSync(
  join(root, 'src/storage/projects.native.ts'),
  'utf8',
);
if (!/function assetFileName\(/.test(nativeSource)) {
  fail(
    'projects.native.ts has no device-file namer, so the store may be writing an archive path',
  );
}
// The specific regression: the device store must never name a file with the
// archive path builder.
if (/writeAssetBytes[\s\S]{0,400}?assetEntryName\(/.test(nativeSource)) {
  fail(
    'projects.native.ts passes assetEntryName (an archive path) to the device filesystem',
  );
}
// The namer and the orphan sweep must agree on the prefix, or the sweep is dead
// code that never matches a live file — which is what happened in C1.
const prefixMatch = nativeSource.match(/const ASSET_PREFIX = '([^']+)'/);
if (!prefixMatch) {
  fail('projects.native.ts has no ASSET_PREFIX');
} else if (!nativeSource.includes('${ASSET_PREFIX}${objectId}.')) {
  fail('the device-file namer does not build the name the sweep parses');
}

// ── the version reader ─────────────────────────────────────────────────────
// A v2 design must be accepted; anything else must be refused. No committed
// script covered this before, so the ledger's claim was an observation, not a
// regression test.
if (schema) {
  if (schema.PROJECT_FILE_VERSION !== 3) {
    fail(`PROJECT_FILE_VERSION is ${schema.PROJECT_FILE_VERSION}, expected 3`);
  }
  const v2 = {
    version: 2,
    id: 'p1',
    name: 'Legacy',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    canvas: {
      width: 1080,
      height: 1080,
      background: { type: 'image', imageFile: 'background.jpg' },
    },
    objects: [],
    gridEnabled: false,
  };
  const normalized = schema.normalizeProjectVersion(v2);
  if (!normalized) {
    fail('a version-2 document was refused — existing designs would vanish');
  } else if (normalized.version !== 3) {
    fail(
      `a version-2 document was not normalized to 3 (got ${normalized.version})`,
    );
  } else if (normalized.canvas.background.imageFile !== 'background.jpg') {
    fail('the reader did not carry the background through');
  }
  for (const bad of [
    { ...v2, version: 1 },
    { ...v2, version: 4 },
    { version: 3, canvas: {} },
    null,
    'nope',
  ]) {
    if (schema.normalizeProjectVersion(bad) !== null) {
      fail(`the reader accepted an invalid document: ${JSON.stringify(bad)}`);
    }
  }
}

// ── the container round-trip ───────────────────────────────────────────────
if (designFile) {
  const v3 = {
    version: 3,
    id: 'p1',
    name: 'Placed',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    canvas: { width: 1080, height: 1080, background: { type: 'paper' } },
    objects: [
      {
        id: 'i_1',
        type: 'image',
        imageFile: 'img_i_1.jpg',
        imageMime: 'image/jpeg',
        // A leaked URI would re-serialise this payload on every autosave.
        imageUri: 'data:image/jpeg;base64,AAAA',
        aspect: 1.5,
        opacity: 1,
        transform: {
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          flipH: false,
          flipV: false,
        },
        zIndex: 10,
      },
    ],
    gridEnabled: false,
  };
  const bytes = designFile.packDesign(v3, null, [
    {
      name: designFile.assetEntryName('i_1', 'image/jpeg'),
      bytes: new Uint8Array([1, 2, 3]),
      mime: 'image/jpeg',
    },
  ]);
  const back = designFile.unpackDesign(bytes);
  if (!back) {
    fail('a version-3 container with an asset did not unpack');
  } else {
    if (back.assets.length !== 1) {
      fail(`the container lost its asset entries (got ${back.assets.length})`);
    } else if (back.assets[0].name !== 'assets/i_1.jpg') {
      fail(`the asset entry name changed: ${back.assets[0].name}`);
    }
    if (back.project.objects[0].imageUri !== undefined) {
      fail('toPersisted leaked a placed image imageUri into the archive');
    }
    if (back.project.objects[0].imageFile !== 'img_i_1.jpg') {
      fail('the object lost its imageFile reference');
    }
  }

  // A background-only design must still round-trip under its own entry name.
  const bgOnly = designFile.packDesign(
    {
      ...v3,
      objects: [],
      canvas: {
        width: 1080,
        height: 1080,
        background: {
          type: 'image',
          imageFile: 'background.png',
          imageMime: 'image/png',
        },
      },
    },
    { bytes: new Uint8Array([9]), mime: 'image/png' },
    [],
  );
  const bgBack = designFile.unpackDesign(bgOnly);
  if (!bgBack) {
    fail('a background-only design no longer unpacks');
  } else if (!bgBack.image) {
    fail('a background-only design lost its image entry');
  } else if (bgBack.image.mime !== 'image/png') {
    fail(`the background's MIME changed to ${bgBack.image.mime}`);
  }
}

// ── the copy helper both repair paths share ────────────────────────────────
// C2 (import) and C3 (duplicate) each discarded every placed image's bytes. Both
// now call this; the assertion is that it writes each object under its **own**
// id, which is what makes a document with several images work.
const copySource = readFileSync(
  join(root, 'src/storage/copy-assets.ts'),
  'utf8',
);
if (!/writeAssetBytes\(targetId, object\.id/.test(copySource)) {
  fail('copyImageAssets does not write each object under its own id');
}
for (const [path, label] of [
  ['src/storage/import-project.ts', 'import'],
  ['src/app/(tabs)/gallery.tsx', 'duplicate'],
]) {
  const source = readFileSync(join(root, path), 'utf8');
  if (!source.includes('copyImageAssets')) {
    fail(`the ${label} path does not copy placed-image bytes`);
  }
}

// ── the two names for the same bytes must not be confused ─────────────────
// The container names an asset `assets/<objectId>.<ext>`; the device store names
// it `img_<objectId>.<ext>`. A lookup that compares one against the other matches
// nothing, and the round trip silently drops every image — which is exactly what
// the first version of the import repair did. Assert the archive lookup derives
// its name from the object id rather than from the object's own `imageFile`.
const importSource = readFileSync(
  join(root, 'src/storage/import-project.ts'),
  'utf8',
);
if (!importSource.includes('assetEntryName(')) {
  fail(
    'the import lookup does not derive the archive entry name from the object',
  );
}
if (
  /a\.name ===\s*object\.imageFile|a\.name ===\s*imageFile/.test(importSource)
) {
  fail(
    'the import lookup compares an archive entry name against a device file name — they never match',
  );
}

// The round-trip assertion, run for real: pack an image object, unpack it, and
// check the entry name the reader must look for is the one the writer produced.
if (designFile) {
  const entry = designFile.assetEntryName('i_1', 'image/jpeg');
  if (entry !== 'assets/i_1.jpg') {
    fail(`assetEntryName produced ${entry}`);
  }
  // The device name the object stores must NOT be the archive name, or the
  // distinction the fix depends on has collapsed.
  if (entry === 'img_i_1.jpg') {
    fail('the archive and device asset names have become the same string');
  }
}

// The saves that can sweep must retain history ids, or a 1-second autosave
// deletes the bytes an undo is about to need.
const autoSaveSource = readFileSync(
  join(root, 'src/editor/use-auto-save.ts'),
  'utf8',
);
if (!autoSaveSource.includes('saveWithHistory')) {
  fail('the autosave does not use the history-aware save (I1)');
}
const retainSource = readFileSync(
  join(root, 'src/editor/save-with-history.ts'),
  'utf8',
);
if (!/future/.test(retainSource) || !/past/.test(retainSource)) {
  fail('the history-aware save does not consider both history stacks');
}

if (failures > 0) {
  console.error(`\ncheck-storage: ${failures} failure(s)`);
  process.exit(1);
}
console.log('check-storage: OK');
