/**
 * Dev-time visual check for the generated glyph catalog.
 *
 * Rasterizes every catalog entry into a single contact sheet PNG so the
 * extracted outlines can be eyeballed — catches shape errors, aspect-ratio
 * mistakes and winding/hole problems that a bbox check cannot.
 *
 * Run after regenerating the catalog:
 *   node scripts/glyph-contact-sheet.mjs
 *
 * Output: `glyph-contact-sheet.png` in the OS temp directory.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = join(ROOT, 'src', 'editor', 'glyphs', 'catalog.ts');
const OUT = join(tmpdir(), 'glyph-contact-sheet.png');

const src = readFileSync(CATALOG, 'utf8');

// The generated file is machine-written and regular, so a targeted pattern is safe here.
const ENTRY =
  /\{\s*key: "([^"]+)",\s*codepoint: (0x[0-9a-f]+),\s*group: "([^"]+)",\s*labelAr: "([^"]*)",\s*labelEn: "([^"]*)",\s*contours: (\d+),\s*box: \{ x: (-?[\d.]+), y: (-?[\d.]+), w: ([\d.]+), h: ([\d.]+) \},\s*d: "([^"]+)",\s*\}/g;

const entries = [];
for (const m of src.matchAll(ENTRY)) {
  entries.push({
    key: m[1],
    codepoint: m[2],
    group: m[3],
    labelEn: m[5],
    contours: Number(m[6]),
    box: { x: +m[7], y: +m[8], w: +m[9], h: +m[10] },
    d: m[11],
  });
}
if (!entries.length)
  throw new Error(
    'no catalog entries parsed — did the generated format change?',
  );

const COLS = 8;
const TILE = 130;
const LABEL = 26;
const INSET = 8;
const rows = Math.ceil(entries.length / COLS);
const width = COLS * TILE;
const height = rows * (TILE + LABEL);

const escape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const parts = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
];

entries.forEach((e, i) => {
  const x = (i % COLS) * TILE;
  const y = Math.floor(i / COLS) * (TILE + LABEL);
  parts.push(
    `<rect x="${x}" y="${y}" width="${TILE}" height="${TILE}" fill="none" stroke="#d8d4cc"/>`,
  );
  parts.push(
    `<svg x="${x + INSET}" y="${y + INSET}" width="${TILE - INSET * 2}" height="${TILE - INSET * 2}" ` +
      `viewBox="${e.box.x} ${e.box.y} ${e.box.w} ${e.box.h}" preserveAspectRatio="xMidYMid meet">` +
      `<path d="${e.d}" fill="#111111"/></svg>`,
  );
  parts.push(
    `<text x="${x + TILE / 2}" y="${y + TILE + 16}" font-family="monospace" font-size="10" ` +
      `fill="#666666" text-anchor="middle">${escape(e.labelEn)}${e.contours > 1 ? ` [${e.contours}]` : ''}</text>`,
  );
});
parts.push('</svg>');

const svg = parts.join('\n');
writeFileSync(OUT.replace(/\.png$/, '.svg'), svg, 'utf8');
await sharp(Buffer.from(svg), { density: 96 }).png().toFile(OUT);

console.log(`entries: ${entries.length}`);
console.log(`wrote  : ${OUT}`);
for (const group of ['mark', 'letter']) {
  const list = entries.filter((e) => e.group === group);
  console.log(`\n[${group}] ${list.length}`);
  for (const e of list) {
    console.log(
      `  ${e.key.padEnd(26)} ${e.codepoint.padEnd(7)} ` +
        `${String(e.box.w).padStart(7)}x${String(e.box.h).padEnd(7)} ` +
        `aspect ${(e.box.w / e.box.h).toFixed(2).padStart(5)}  contours ${e.contours}`,
    );
  }
}
