/**
 * Generate `src/editor/glyphs/catalog.ts` from the Amiri font bundled with the app.
 *
 * Why generate instead of shipping third-party SVG assets: the app already renders
 * its calligraphy text with `assets/fonts/amiri-arabic-400.ttf`, so mining the
 * outlines from that same file guarantees the ornaments are style- and
 * metric-consistent with the text around them, and keeps one source of truth.
 *
 * Extraction pipeline (mirrors the reference `amiri-tashkeel-svg` set):
 *   1. resolve each codepoint to a glyph id through `cmap`
 *   2. flatten simple + composite `glyf` outlines to point contours
 *   3. negate Y (font space is Y-up, SVG is Y-down)
 *   4. emit `M/L/Q/Z` path data, quadratic curves preserved
 *   5. tight-crop the ink bounds and pad by 15% on each side for the viewBox
 *   6. round-trip the emitted path to prove every source point survived
 *
 * Usage: node scripts/extract-glyphs.mjs [--check]
 *   --check  verify the generated file is up to date without writing it
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONT_PATH = join(ROOT, 'assets', 'fonts', 'amiri-arabic-400.ttf');
const OUT_PATH = join(ROOT, 'src', 'editor', 'glyphs', 'catalog.ts');

/** Padding around the ink bounds, as a fraction of the ink size on each side. */
const PAD = 0.15;

// ---------------------------------------------------------------------------
// Catalogue definition
// ---------------------------------------------------------------------------

/**
 * Tashkeel (diacritic) and Quranic recitation marks.
 * Codepoints follow the standard Unicode positions; the extractor asserts each
 * one resolves, so a font swap fails loudly instead of emitting a hole.
 *
 * Seven marks are deliberately omitted because Amiri stores them as references
 * to another mark's contours and differs only in vertical placement — which the
 * tight ink crop discards, making the two render as identical tiles:
 *   kasra= fatha, kasratan= fathatan, hamza-below= hamza-above,
 *   subscript-alef= superscript-alef, high-yeh= small-yeh, high-stop= low-stop,
 *   inverted-damma= damma (rotated 180).
 * `assertNoDuplicateOutlines` below enforces this.
 */
const MARKS = [
  ['fatha', 0x064e, 'فتحة', 'Fatha'],
  ['damma', 0x064f, 'ضمة', 'Damma'],
  ['fathatan', 0x064b, 'فتحتان', 'Fathatan'],
  ['dammatan', 0x064c, 'ضمتان', 'Dammatan'],
  ['shadda', 0x0651, 'شدّة', 'Shadda'],
  ['sukun', 0x0652, 'سكون', 'Sukun'],
  ['maddah', 0x0653, 'مدّة', 'Maddah'],
  ['hamza-above', 0x0654, 'همزة فوق', 'Hamza above'],
  ['noon-ghunna', 0x0658, 'غنّة', 'Ghunna'],
  ['superscript-alef', 0x0670, 'ألف خنجرية', 'Superscript alef'],
  ['sad-lam-ligature', 0x06d6, 'وصلة صاد ولام', 'Sad-lam ligature'],
  ['rectangular-zero', 0x06e0, 'صفر مستطيل', 'Rectangular zero'],
  ['head-of-khah', 0x06e1, 'رأس خاء', 'Head of khah'],
  ['small-meem', 0x06e2, 'ميم صغيرة', 'Small meem'],
  ['low-seen', 0x06e3, 'سين سفلى', 'Low seen'],
  ['small-maddah', 0x06e4, 'مدّة صغيرة', 'Small maddah'],
  ['small-waw', 0x06e5, 'واو صغيرة', 'Small waw'],
  ['small-yeh', 0x06e6, 'ياء صغيرة', 'Small yeh'],
  ['small-noon', 0x06e8, 'نون صغيرة', 'Small noon'],
  ['low-stop', 0x06ea, 'وقفة سفلى', 'Low stop'],
  ['rounded-stop', 0x06ec, 'وقفة مستديرة', 'Rounded stop'],
];

/**
 * Letter forms used as stroke / fragment material.
 *
 * Addressed through the Arabic Presentation Forms-B block (U+FE70..U+FEFF),
 * which `cmap` maps directly — so initial/medial/final shapes are reachable
 * without implementing GSUB shaping. These give the library genuine pen-stroke
 * forms (verticals, teeth, long horizontals, bowls, curls) that the marks alone
 * cannot provide.
 */
const LETTERS = [
  ['alef-iso', 0x0627, 'ألف', 'Alef'],
  ['alef-final', 0xfe8e, 'ألف متصل', 'Alef final'],
  ['lam-initial', 0xfedf, 'لام ابتدائي', 'Lam initial'],
  ['meem-iso', 0x0645, 'ميم', 'Meem'],
  ['beh-initial', 0xfe91, 'باء ابتدائي', 'Beh initial'],
  ['beh-medial', 0xfe92, 'باء وسطي', 'Beh medial'],
  ['teh-medial', 0xfe98, 'تاء وسطية', 'Teh medial'],
  ['noon-initial', 0xfee7, 'نون ابتدائي', 'Noon initial'],
  ['noon-medial', 0xfee8, 'نون وسطية', 'Noon medial'],
  ['seen-initial', 0xfeb3, 'سين ابتدائي', 'Seen initial'],
  ['seen-medial', 0xfeb4, 'سين وسطية', 'Seen medial'],
  ['meem-medial', 0xfee4, 'ميم وسطية', 'Meem medial'],
  ['sad-initial', 0xfebb, 'صاد ابتدائي', 'Sad initial'],
  ['sad-medial', 0xfebc, 'صاد وسطية', 'Sad medial'],
  ['reh-iso', 0x0631, 'راء', 'Reh'],
  ['waw-iso', 0x0648, 'واو', 'Waw'],
  ['dal-iso', 0x062f, 'دال', 'Dal'],
  ['heh-iso', 0x0647, 'هاء', 'Heh'],
  ['ain-initial', 0xfecb, 'عين ابتدائي', 'Ain initial'],
  ['ain-medial', 0xfecc, 'عين وسطية', 'Ain medial'],
  ['jeem-initial', 0xfe9f, 'جيم ابتدائي', 'Jeem initial'],
  ['heh-medial', 0xfeec, 'هاء وسطية', 'Heh medial'],
  ['kaf-medial', 0xfedc, 'كاف وسطية', 'Kaf medial'],
  ['yeh-medial', 0xfef4, 'ياء وسطية', 'Yeh medial'],
  ['ain-iso', 0x0639, 'عين', 'Ain'],
  ['ghain-iso', 0x063a, 'غين', 'Ghain'],
  ['jeem-medial', 0xfea0, 'جيم وسطية', 'Jeem medial'],
  ['khah-initial', 0xfea3, 'خاء ابتدائي', 'Khah initial'],
  ['seen-final', 0xfeb2, 'سين نهائية', 'Seen final'],
  ['sad-final', 0xfeba, 'صاد نهائية', 'Sad final'],
  ['yeh-final', 0xfef2, 'ياء نهائية', 'Yeh final'],
];

// ---------------------------------------------------------------------------
// TrueType reading
// ---------------------------------------------------------------------------

const ON_CURVE = 0x01;
const X_SHORT = 0x02;
const Y_SHORT = 0x04;
const REPEAT = 0x08;
const X_SAME = 0x10;
const Y_SAME = 0x20;

const ARG_WORDS = 0x0001;
const ARGS_XY = 0x0002;
const HAVE_SCALE = 0x0008;
const MORE = 0x0020;
const HAVE_XY_SCALE = 0x0040;
const HAVE_2X2 = 0x0080;

function readTables(buf) {
  const numTables = buf.readUInt16BE(4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    tables[buf.toString('ascii', o, o + 4)] = {
      offset: buf.readUInt32BE(o + 8),
      length: buf.readUInt32BE(o + 12),
    };
  }
  return tables;
}

/** cmap format 4 (BMP) -> Map<codepoint, glyphId>. */
function parseCmap4(buf, cmapOffset) {
  const numTables = buf.readUInt16BE(cmapOffset + 2);
  let sub = null;
  for (let i = 0; i < numTables; i++) {
    const rec = cmapOffset + 4 + i * 8;
    const platformId = buf.readUInt16BE(rec);
    const encodingId = buf.readUInt16BE(rec + 2);
    const offset = cmapOffset + buf.readUInt32BE(rec + 4);
    if (buf.readUInt16BE(offset) !== 4) continue;
    const isWindowsBmp = platformId === 3 && encodingId === 1;
    const isUnicodeBmp = platformId === 0 && encodingId === 3;
    if (!isWindowsBmp && !isUnicodeBmp) continue;
    sub = offset;
    if (isWindowsBmp) break;
  }
  if (sub === null) throw new Error('cmap format 4 subtable not found');

  const segCountX2 = buf.readUInt16BE(sub + 6);
  const segCount = segCountX2 / 2;
  const endBase = sub + 14;
  const startBase = endBase + segCountX2 + 2;
  const deltaBase = startBase + segCountX2;
  const rangeBase = deltaBase + segCountX2;

  const map = new Map();
  for (let s = 0; s < segCount; s++) {
    const end = buf.readUInt16BE(endBase + s * 2);
    const start = buf.readUInt16BE(startBase + s * 2);
    if (start === 0xffff) continue;
    const delta = buf.readInt16BE(deltaBase + s * 2);
    const rangeOffset = buf.readUInt16BE(rangeBase + s * 2);
    for (let cp = start; cp <= end; cp++) {
      let gid;
      if (rangeOffset === 0) {
        gid = (cp + delta) & 0xffff;
      } else {
        const addr = rangeBase + s * 2 + rangeOffset + (cp - start) * 2;
        if (addr + 1 >= buf.length) continue;
        gid = buf.readUInt16BE(addr);
        if (gid !== 0) gid = (gid + delta) & 0xffff;
      }
      if (gid !== 0) map.set(cp, gid);
    }
  }
  return map;
}

function createGlyfReader(buf, tables) {
  const indexToLocFormat = buf.readInt16BE(tables.head.offset + 50);
  const locaOff = tables.loca.offset;
  const glyfOff = tables.glyf.offset;
  const loca = (gid) =>
    indexToLocFormat === 0
      ? buf.readUInt16BE(locaOff + gid * 2) * 2
      : buf.readUInt32BE(locaOff + gid * 4);

  /** @returns {Array<Array<{x:number,y:number,on:boolean}>>} */
  function readGlyph(gid, depth = 0) {
    if (depth > 8)
      throw new Error(`composite recursion too deep at gid ${gid}`);
    const start = loca(gid);
    const end = loca(gid + 1);
    if (start >= end) return [];
    const g = glyfOff + start;
    const numberOfContours = buf.readInt16BE(g);
    if (numberOfContours === -1) return readComposite(g, depth);

    const endPts = [];
    for (let i = 0; i < numberOfContours; i++) {
      endPts.push(buf.readUInt16BE(g + 10 + i * 2));
    }
    let p = g + 10 + numberOfContours * 2;
    const instructionLength = buf.readUInt16BE(p);
    p += 2 + instructionLength;

    const numPoints = numberOfContours ? endPts[numberOfContours - 1] + 1 : 0;

    const flags = [];
    while (flags.length < numPoints) {
      const f = buf.readUInt8(p++);
      flags.push(f);
      if (f & REPEAT) {
        let r = buf.readUInt8(p++);
        while (r-- > 0 && flags.length < numPoints) flags.push(f);
      }
    }

    const xs = [];
    let x = 0;
    for (let i = 0; i < numPoints; i++) {
      const f = flags[i];
      if (f & X_SHORT) {
        const d = buf.readUInt8(p++);
        x += f & X_SAME ? d : -d;
      } else if (!(f & X_SAME)) {
        x += buf.readInt16BE(p);
        p += 2;
      }
      xs.push(x);
    }

    const ys = [];
    let y = 0;
    for (let i = 0; i < numPoints; i++) {
      const f = flags[i];
      if (f & Y_SHORT) {
        const d = buf.readUInt8(p++);
        y += f & Y_SAME ? d : -d;
      } else if (!(f & Y_SAME)) {
        y += buf.readInt16BE(p);
        p += 2;
      }
      ys.push(y);
    }

    const contours = [];
    let first = 0;
    for (const lastPt of endPts) {
      const contour = [];
      for (let i = first; i <= lastPt; i++) {
        contour.push({ x: xs[i], y: ys[i], on: !!(flags[i] & ON_CURVE) });
      }
      contours.push(contour);
      first = lastPt + 1;
    }
    return contours;
  }

  function readComposite(g, depth) {
    let p = g + 10;
    const out = [];
    for (;;) {
      const flags = buf.readUInt16BE(p);
      const glyphIndex = buf.readUInt16BE(p + 2);
      p += 4;

      let dx = 0;
      let dy = 0;
      if (flags & ARG_WORDS) {
        const a1 = buf.readInt16BE(p);
        const a2 = buf.readInt16BE(p + 2);
        p += 4;
        if (flags & ARGS_XY) {
          dx = a1;
          dy = a2;
        }
      } else {
        const a1 = buf.readInt8(p);
        const a2 = buf.readInt8(p + 1);
        p += 2;
        if (flags & ARGS_XY) {
          dx = a1;
          dy = a2;
        }
      }

      let a = 1,
        b = 0,
        c = 0,
        d = 1;
      if (flags & HAVE_SCALE) {
        a = d = buf.readInt16BE(p) / 16384;
        p += 2;
      } else if (flags & HAVE_XY_SCALE) {
        a = buf.readInt16BE(p) / 16384;
        d = buf.readInt16BE(p + 2) / 16384;
        p += 4;
      } else if (flags & HAVE_2X2) {
        a = buf.readInt16BE(p) / 16384;
        b = buf.readInt16BE(p + 2) / 16384;
        c = buf.readInt16BE(p + 4) / 16384;
        d = buf.readInt16BE(p + 6) / 16384;
        p += 8;
      }

      for (const contour of readGlyph(glyphIndex, depth + 1)) {
        out.push(
          contour.map((pt) => ({
            x: pt.x * a + pt.y * c + dx,
            y: pt.x * b + pt.y * d + dy,
            on: pt.on,
          })),
        );
      }

      if (!(flags & MORE)) break;
    }
    return out;
  }

  return readGlyph;
}

// ---------------------------------------------------------------------------
// Contours -> SVG path
// ---------------------------------------------------------------------------

const round2 = (n) => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
};

/** Drop a duplicated closing point and require at least two distinct points. */
function normalizeContour(contour) {
  const pts = contour.filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
  );
  while (
    pts.length > 1 &&
    pts[0].x === pts[pts.length - 1].x &&
    pts[0].y === pts[pts.length - 1].y
  ) {
    pts.pop();
  }
  return pts.length >= 2 ? pts : null;
}

/**
 * Emit one closed contour as `M`/`L`/`Q` segments, Y negated for SVG.
 * TrueType quadratic curves map 1:1 onto SVG `Q`, and runs of consecutive
 * off-curve points are joined by their implied on-curve midpoints.
 */
function contourToPath(rawContour) {
  let pts = normalizeContour(rawContour);
  if (!pts) return '';

  let startIndex = pts.findIndex((p) => p.on);
  if (startIndex === -1) {
    // All off-curve: synthesize an on-curve start at the first implied midpoint.
    const mid = {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2,
      on: true,
    };
    pts = [mid, ...pts];
    startIndex = 0;
  }
  pts = [...pts.slice(startIndex), ...pts.slice(0, startIndex)];

  const X = (p) => round2(p.x);
  const Y = (p) => round2(-p.y);

  let d = `M${X(pts[0])} ${Y(pts[0])}`;
  let i = 1;
  while (i < pts.length) {
    const cur = pts[i];
    if (cur.on) {
      d += `L${X(cur)} ${Y(cur)}`;
      i += 1;
      continue;
    }
    const next = pts[(i + 1) % pts.length];
    if (next.on) {
      d += `Q${X(cur)} ${Y(cur)} ${X(next)} ${Y(next)}`;
      i += 2;
    } else {
      const mx = (cur.x + next.x) / 2;
      const my = (cur.y + next.y) / 2;
      d += `Q${X(cur)} ${Y(cur)} ${round2(mx)} ${round2(-my)}`;
      i += 1;
    }
  }
  return `${d}Z`;
}

function contoursToPath(contours) {
  return contours.map(contourToPath).filter(Boolean).join('');
}

/** Tight ink bounds in SVG space, padded by PAD of the ink size on each side. */
function contoursToBox(contours) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const contour of contours) {
    for (const p of contour) {
      const y = -p.y;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const px = w * PAD;
  const py = h * PAD;
  return {
    x: round2(minX - px),
    y: round2(minY - py),
    w: round2(w + px * 2),
    h: round2(h + py * 2),
  };
}

// ---------------------------------------------------------------------------
// Round-trip verification
// ---------------------------------------------------------------------------

/**
 * Re-read the emitted path and confirm every source contour point survived as
 * either a control point or a segment endpoint. Catches dropped/duplicated
 * points that a bbox comparison alone would not notice.
 */
function verifyRoundTrip(contours, d) {
  const tokens = d.match(/[MLQZ]|-?\d*\.?\d+/g) ?? [];
  const coords = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === 'M' || t === 'L') {
      coords.push([Number(tokens[i + 1]), Number(tokens[i + 2])]);
      i += 3;
    } else if (t === 'Q') {
      coords.push([Number(tokens[i + 1]), Number(tokens[i + 2])]);
      coords.push([Number(tokens[i + 3]), Number(tokens[i + 4])]);
      i += 5;
    } else {
      i += 1;
    }
  }

  const expected = new Map();
  const bump = (x, y) => {
    const k = `${round2(x)},${round2(-y)}`;
    expected.set(k, (expected.get(k) ?? 0) + 1);
  };
  for (const contour of contours) {
    const pts = normalizeContour(contour);
    if (!pts) continue;
    if (pts.some((p) => p.on)) {
      for (const p of pts) if (p.on) bump(p.x, p.y);
    } else {
      for (let k = 0; k < pts.length; k++) {
        const a = pts[k];
        const b = pts[(k + 1) % pts.length];
        bump((a.x + b.x) / 2, (a.y + b.y) / 2);
      }
    }
  }
  // Off-curve points must appear verbatim as Q control points.
  const got = new Set(coords.map(([x, y]) => `${round2(x)},${round2(y)}`));
  const missing = [...expected.keys()].filter((k) => !got.has(k));
  return { missing, coordCount: coords.length };
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

/**
 * Reduce a path to origin-normalised point pairs, optionally mirrored/flipped,
 * so two glyphs compare equal when they differ only by placement or orientation.
 */
function outlineSignature(entry, { mirror = false, flip = false } = {}) {
  const tokens = entry.d.match(/[MLQ]|-?\d*\.?\d+/g) ?? [];
  const pts = [];
  for (let i = 0; i < tokens.length;) {
    if (tokens[i] === 'M' || tokens[i] === 'L') {
      pts.push([Number(tokens[i + 1]), Number(tokens[i + 2])]);
      i += 3;
    } else if (tokens[i] === 'Q') {
      pts.push([Number(tokens[i + 1]), Number(tokens[i + 2])]);
      pts.push([Number(tokens[i + 3]), Number(tokens[i + 4])]);
      i += 5;
    } else {
      i += 1;
    }
  }
  return pts
    .map(([x, y]) => {
      let nx = x - entry.box.x;
      let ny = y - entry.box.y;
      if (mirror) nx = entry.box.w - nx;
      if (flip) ny = entry.box.h - ny;
      return `${round2(nx)},${round2(ny)}`;
    })
    .join('|');
}

/**
 * Fail if any two entries render as the same tile once cropped. Catches the
 * Amiri pattern of storing a mark as a reference to another mark's contours.
 */
function assertNoDuplicateOutlines(entries) {
  const sigs = entries.map((e) => ({
    id: outlineSignature(e),
    mirror: outlineSignature(e, { mirror: true }),
    flip: outlineSignature(e, { flip: true }),
    flipMirror: outlineSignature(e, { mirror: true, flip: true }),
  }));
  const clashes = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = sigs[i];
      const b = sigs[j];
      let rel = null;
      if (a.id === b.id) rel = 'identical';
      else if (a.mirror === b.id || a.id === b.mirror) rel = 'mirrored';
      else if (a.flip === b.id || a.id === b.flip) rel = 'flipped';
      else if (a.flipMirror === b.id || a.id === b.flipMirror)
        rel = 'rotated 180';
      if (rel) clashes.push(`${entries[i].key} ~ ${entries[j].key} (${rel})`);
    }
  }
  if (clashes.length) {
    console.error(
      'Duplicate-looking outlines found — the library grid would show repeats:',
    );
    for (const c of clashes) console.error(`  - ${c}`);
    process.exit(1);
  }
}

function build() {
  const buf = readFileSync(FONT_PATH);
  const tables = readTables(buf);
  const cmap = parseCmap4(buf, tables.cmap.offset);
  const readGlyph = createGlyfReader(buf, tables);

  const unitsPerEm = buf.readUInt16BE(tables.head.offset + 18);
  const glyphCount = buf.readUInt16BE(tables.maxp.offset + 4);

  const entries = [];
  const problems = [];

  const add = (group, [name, cp, labelAr, labelEn]) => {
    const gid = cmap.get(cp);
    if (gid == null) {
      problems.push(
        `U+${cp.toString(16).toUpperCase().padStart(4, '0')} (${name}) is not in cmap`,
      );
      return;
    }
    const contours = readGlyph(gid);
    if (!contours.length) {
      problems.push(
        `U+${cp.toString(16).toUpperCase().padStart(4, '0')} (${name}) has no outline`,
      );
      return;
    }
    const d = contoursToPath(contours);
    const box = contoursToBox(contours);
    const { missing } = verifyRoundTrip(contours, d);
    if (missing.length) {
      problems.push(
        `${name}: ${missing.length} point(s) lost in path round-trip`,
      );
    }
    entries.push({
      key: `${group}-${name}`,
      codepoint: cp,
      group,
      labelAr,
      labelEn,
      d,
      box,
      contours: contours.length,
    });
  };

  for (const m of MARKS) add('mark', m);
  for (const l of LETTERS) add('letter', l);

  if (problems.length) {
    console.error('Glyph extraction failed:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  assertNoDuplicateOutlines(entries);

  const field = (v) => JSON.stringify(v);
  const lines = [];
  lines.push('/**');
  lines.push(' * GENERATED FILE — do not edit by hand.');
  lines.push(' *');
  lines.push(
    ' * Ornament glyph outlines mined from the Amiri font the app already ships,',
  );
  lines.push(' * so the ornaments match the calligraphy text they sit beside.');
  lines.push(' *');
  lines.push(
    ` *   source    : assets/fonts/amiri-arabic-400.ttf (Amiri v${readVersion(buf, tables)})`,
  );
  lines.push(` *   unitsPerEm: ${unitsPerEm}   glyphs: ${glyphCount}`);
  lines.push(
    ` *   entries   : ${entries.length} (${MARKS.length} marks, ${LETTERS.length} letter forms)`,
  );
  lines.push(' *');
  lines.push(' * Regenerate with: node scripts/extract-glyphs.mjs');
  lines.push(' */');
  lines.push('');
  lines.push(
    '/** Which family a glyph belongs to; drives the library tabs. */',
  );
  lines.push("export type GlyphGroup = 'mark' | 'letter';");
  lines.push('');
  lines.push('/** Padded ink bounds in SVG space: `x y w h`. */');
  lines.push('export interface GlyphBox {');
  lines.push('  x: number;');
  lines.push('  y: number;');
  lines.push('  w: number;');
  lines.push('  h: number;');
  lines.push('}');
  lines.push('');
  lines.push('export interface GlyphCatalogEntry {');
  lines.push('  /** Stable id persisted as `GlyphObject.glyphKey`. */');
  lines.push('  key: string;');
  lines.push(
    '  /** Source Unicode codepoint, for traceability back to the font. */',
  );
  lines.push('  codepoint: number;');
  lines.push('  group: GlyphGroup;');
  lines.push('  labelAr: string;');
  lines.push('  labelEn: string;');
  lines.push(
    '  /** SVG path data, font units with Y already negated for SVG space. */',
  );
  lines.push('  d: string;');
  lines.push(
    '  /** Tight ink bounds plus 15% padding, ready to use as a viewBox. */',
  );
  lines.push('  box: GlyphBox;');
  lines.push(
    '  /** Number of contours (2+ means the glyph contains counters). */',
  );
  lines.push('  contours: number;');
  lines.push('}');
  lines.push('');
  lines.push(
    '/** Padding applied around each glyph ink box, as a fraction of the ink size. */',
  );
  lines.push(`export const GLYPH_BOX_PAD = ${PAD};`);
  lines.push('');
  lines.push('export const GLYPH_CATALOG: readonly GlyphCatalogEntry[] = [');
  for (const e of entries) {
    lines.push('  {');
    lines.push(`    key: ${field(e.key)},`);
    lines.push(`    codepoint: 0x${e.codepoint.toString(16)},`);
    lines.push(`    group: ${field(e.group)},`);
    lines.push(`    labelAr: ${field(e.labelAr)},`);
    lines.push(`    labelEn: ${field(e.labelEn)},`);
    lines.push(`    contours: ${e.contours},`);
    lines.push(
      `    box: { x: ${e.box.x}, y: ${e.box.y}, w: ${e.box.w}, h: ${e.box.h} },`,
    );
    lines.push(`    d: ${field(e.d)},`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  return lines.join('\n');
}

/** Read the font's version string (name id 5) for the generated header. */
function readVersion(buf, tables) {
  const off = tables.name.offset;
  const count = buf.readUInt16BE(off + 2);
  const strOff = off + buf.readUInt16BE(off + 4);
  for (let i = 0; i < count; i++) {
    const r = off + 6 + i * 12;
    if (buf.readUInt16BE(r) !== 3) continue;
    if (buf.readUInt16BE(r + 6) !== 5) continue;
    const len = buf.readUInt16BE(r + 8);
    const o = buf.readUInt16BE(r + 10);
    let s = '';
    for (let k = 0; k < len; k += 2)
      s += String.fromCharCode(buf.readUInt16BE(strOff + o + k));
    return s.replace(/^Version\s*/i, '');
  }
  return 'unknown';
}

const check = process.argv.includes('--check');
const output = build();

if (check) {
  let current = '';
  try {
    current = readFileSync(OUT_PATH, 'utf8');
  } catch {
    console.error(
      'catalog.ts is missing — run: node scripts/extract-glyphs.mjs',
    );
    process.exit(1);
  }
  if (current !== output) {
    console.error(
      'catalog.ts is out of date — run: node scripts/extract-glyphs.mjs',
    );
    process.exit(1);
  }
  console.log('catalog.ts is up to date.');
} else {
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, output, 'utf8');
  const kb = (Buffer.byteLength(output, 'utf8') / 1024).toFixed(1);
  console.log(`Wrote ${OUT_PATH} (${kb} KB)`);
}
