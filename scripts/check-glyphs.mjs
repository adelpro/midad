/**
 * Standalone verification for ornament (glyph) rendering.
 *
 * Ornaments are filled Amiri outlines. A placed ornament picks one of three
 * paint styles — `solid` fills the outline (the heavy, traditional look),
 * while `outline` and `thin` stroke it at a fixed fraction of its longest ink
 * side. Every paint site — live canvas, PNG, SVG and the library tile — must
 * read the same style model (`glyphStyleOf` + `glyphStrokeWidth(entry, style)`)
 * or the four renderers drift from each other and from the object's stored
 * style, which the render contract has no other way to notice.
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
  // index.ts imports `type` from the schema only, which transpileModule erases;
  // a value import here means the standalone evaluation silently lost a symbol.
  throw new Error(`index.ts imported an unexpected module: ${id}`);
});

const { GLYPH_CATALOG } = catalog;
const {
  GLYPH_DEFAULT_STYLE,
  GLYPH_STYLE_ORDER,
  GLYPH_STROKE_RATIO,
  GLYPH_THIN_STROKE_RATIO,
  glyphStrokeWidth,
  glyphStyleOf,
  nextGlyphStyle,
} = glyphs;

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`FAIL: ${m}`);
};
const eq = (label, got, want) => {
  if (got !== want) fail(`${label}: got ${got}, want ${want}`);
};

// The style model: three named styles, the default first in the cycle so the
// "next style" action offers the filled look with one tap off a fresh outline.
eq(
  'GLYPH_DEFAULT_STYLE is outline (the pre-styles behaviour)',
  GLYPH_DEFAULT_STYLE,
  'outline',
);
eq(
  'GLYPH_STYLE_ORDER is the full set, exactly once',
  JSON.stringify(GLYPH_STYLE_ORDER),
  JSON.stringify(['outline', 'solid', 'thin']),
);

// The ratios are real line weights: positive, and small fractions of ink size.
if (!(GLYPH_STROKE_RATIO > 0 && GLYPH_STROKE_RATIO < 0.2)) {
  fail(`GLYPH_STROKE_RATIO is not a plausible fraction: ${GLYPH_STROKE_RATIO}`);
}
if (!(
  GLYPH_THIN_STROKE_RATIO > 0 && GLYPH_THIN_STROKE_RATIO < GLYPH_STROKE_RATIO
)) {
  fail(
    `GLYPH_THIN_STROKE_RATIO (${GLYPH_THIN_STROKE_RATIO}) must be finer than the outline ratio (${GLYPH_STROKE_RATIO})`,
  );
}

// Width is a fixed fraction of the longest ink side, so the weight is constant
// across glyphs of very different aspect ratios and sizes.
for (const key of ['mark-fatha', 'letter-seen-initial', 'letter-alef-iso']) {
  const entry = GLYPH_CATALOG.find((e) => e.key === key);
  if (!entry) {
    fail(`catalog is missing ${key}`);
    continue;
  }
  const side = Math.max(entry.box.w, entry.box.h);
  eq(
    `outline stroke of ${key}`,
    glyphStrokeWidth(entry, 'outline'),
    GLYPH_STROKE_RATIO * side,
  );
  eq(
    `thin stroke of ${key}`,
    glyphStrokeWidth(entry, 'thin'),
    GLYPH_THIN_STROKE_RATIO * side,
  );
  eq(`solid width of ${key} is 0`, glyphStrokeWidth(entry, 'solid'), 0);
}

// A degenerate box must not produce a zero/NaN width.
eq(
  'degenerate box floors at the outline ratio',
  glyphStrokeWidth({ box: { x: 0, y: 0, w: 0, h: 0 } }, 'outline'),
  GLYPH_STROKE_RATIO,
);

// Unknown styles resolve to the outline weight rather than NaN.
eq(
  'unknown style falls back to the outline ratio',
  glyphStrokeWidth({ box: { x: 0, y: 0, w: 0, h: 0 } }, 'vintage'),
  GLYPH_STROKE_RATIO,
);

// The persisted object's style resolution and the cycle that edits it.
eq('missing glyphStyle reads as outline', glyphStyleOf({}), 'outline');
eq('stored glyphStyle wins', glyphStyleOf({ glyphStyle: 'solid' }), 'solid');
eq('cycle: outline → solid', nextGlyphStyle('outline'), 'solid');
eq('cycle: solid → thin', nextGlyphStyle('solid'), 'thin');
eq('cycle: thin → outline', nextGlyphStyle('thin'), 'outline');
for (const style of GLYPH_STYLE_ORDER) {
  if (!GLYPH_STYLE_ORDER.includes(nextGlyphStyle(style))) {
    fail(`nextGlyphStyle left the style set from ${style}`);
  }
}

// Every paint site must read the shared style model, or the four renderers
// drift. The PNG path shares glyph-shape.tsx with the live canvas, so three
// files cover the four sites.
const OBJECT_SITES = [
  'src/editor/skia/glyph-shape.tsx',
  'src/editor/export/svg.ts',
];
for (const rel of OBJECT_SITES) {
  const src = readFileSync(join(root, rel), 'utf8');
  if (!src.includes('glyphStyleOf')) {
    fail(
      `${rel} does not resolve the object's glyphStyle — its ornament would drift`,
    );
  }
  if (!src.includes('glyphStrokeWidth')) {
    fail(`${rel} does not use glyphStrokeWidth — its ornament would drift`);
  }
}
const TILE_SITE = 'src/editor/insert-sheet.tsx';
{
  const src = readFileSync(join(root, TILE_SITE), 'utf8');
  if (!src.includes('glyphStrokeWidth')) {
    fail(`${TILE_SITE} does not use glyphStrokeWidth — its tile would drift`);
  }
}

// The SVG glyph branch must paint both idioms: a fill for `solid` and a stroke
// for the line styles, so an export cannot silently regress to one of them.
const svg = readFileSync(join(root, 'src/editor/export/svg.ts'), 'utf8');
if (!svg.includes('fill="${escapeXml(glyph.color)}"')) {
  fail('src/editor/export/svg.ts no longer fills the solid glyph path');
}
if (!svg.includes('stroke="${escapeXml(glyph.color)}"')) {
  fail('src/editor/export/svg.ts no longer strokes the line-art glyph path');
}
if (!svg.includes('stroke-width="${glyphStrokeWidth(entry, style)}"')) {
  fail('src/editor/export/svg.ts no longer uses the per-style shared width');
}

if (failures > 0) {
  console.error(`\ncheck-glyphs: ${failures} failure(s)`);
  process.exit(1);
}
console.log('check-glyphs: OK');
