/**
 * Standalone verification for ornament (glyph) rendering.
 *
 * Ornaments are filled Amiri outlines, so a filled silhouette reads far too
 * heavy. Every paint site — live canvas, PNG, SVG and the library tile — must
 * stroke the path instead, at the one shared `glyphStrokeWidth`. This pins that
 * value and that the four sites keep reading it, since the render contract has
 * no other way to notice a glyph that starts filling again.
 *
 * Run: node scripts/check-glyphs.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/** Transpile one module and evaluate it, resolving its imports through `require`. */
function loadModule(relPath, require) {
  const source = readFileSync(join(root, relPath), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const shim = { exports: {} };
  new Function('exports', 'module', 'require', outputText)(
    shim.exports,
    shim,
    require,
  );
  return shim.exports;
}

const catalog = loadModule('src/editor/glyphs/catalog.ts', () => {
  throw new Error('catalog imports nothing');
});
const glyphs = loadModule('src/editor/glyphs/index.ts', (id) => {
  if (id.includes('glyphs/catalog')) return catalog;
  throw new Error(`index.ts imported an unexpected module: ${id}`);
});

const { GLYPH_CATALOG } = catalog;
const { GLYPH_STROKE_RATIO, glyphStrokeWidth } = glyphs;

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`FAIL: ${m}`);
};
const eq = (label, got, want) => {
  if (got !== want) fail(`${label}: got ${got}, want ${want}`);
};

// The ratio is a real line weight: positive, and a small fraction of ink size.
if (!(GLYPH_STROKE_RATIO > 0 && GLYPH_STROKE_RATIO < 0.2)) {
  fail(`GLYPH_STROKE_RATIO is not a plausible fraction: ${GLYPH_STROKE_RATIO}`);
}

// Width is a fixed fraction of the longest ink side, so the weight is constant
// across glyphs of very different aspect ratios and sizes.
for (const key of ['mark-fatha', 'letter-seen-initial', 'letter-alef-iso']) {
  const entry = GLYPH_CATALOG.find((e) => e.key === key);
  if (!entry) {
    fail(`catalog is missing ${key}`);
    continue;
  }
  const expected = GLYPH_STROKE_RATIO * Math.max(entry.box.w, entry.box.h);
  eq(`stroke of ${key}`, glyphStrokeWidth(entry), expected);
}

// A degenerate box must not produce a zero/NaN width.
eq(
  'degenerate box floors at the ratio',
  glyphStrokeWidth({ box: { x: 0, y: 0, w: 0, h: 0 } }),
  GLYPH_STROKE_RATIO,
);

// Every paint site must read the shared width, or the four renderers drift.
const SITES = [
  'src/editor/skia/glyph-shape.tsx',
  'src/editor/export/svg.ts',
  'src/editor/insert-sheet.tsx',
];
for (const rel of SITES) {
  const src = readFileSync(join(root, rel), 'utf8');
  if (!src.includes('glyphStrokeWidth')) {
    fail(`${rel} does not use glyphStrokeWidth — its ornament would drift`);
  }
}

// The fill is what made them heavy; the SVG glyph branch must not emit one.
const svg = readFileSync(join(root, 'src/editor/export/svg.ts'), 'utf8');
if (svg.includes('fill="${escapeXml(glyph.color)}"')) {
  fail('src/editor/export/svg.ts still fills the glyph path');
}
if (!svg.includes('stroke="${escapeXml(glyph.color)}"')) {
  fail('src/editor/export/svg.ts no longer strokes the glyph path');
}

if (failures > 0) {
  console.error(`\ncheck-glyphs: ${failures} failure(s)`);
  process.exit(1);
}
console.log('check-glyphs: OK');
