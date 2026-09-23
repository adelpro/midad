import { Asset } from 'expo-asset';

import { getGlyphEntry, glyphPlacement } from '@/editor/glyphs';
import {
  SHAPE_BASE_SIZE,
  SHAPE_INSET,
  SHAPE_PATH_BUILDERS,
} from '@/editor/skia/shape-geometry';
import type {
  CalligraphyTextObject,
  GlyphObject,
  MidadProject,
  ShapeObject,
} from '@/storage/project-schema';
import { fontAssets } from '@/theme';

export interface SvgFontFace {
  family: string;
  dataUri: string;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * The `@font-face` family name for a stored fontKey.
 *
 * The key names the exact variant, and its own asset is embedded under that
 * name — so `Amiri-Bold` exports the bold file rather than collapsing to the
 * regular Amiri face. Unknown keys fall back to Amiri.
 */
function familyForKey(fontKey: string): string {
  return fontKey in fontAssets ? fontKey : 'Amiri';
}

/** XML id for an object's drop-shadow filter. */
function shadowFilterId(objectId: string): string {
  // Object ids are not guaranteed to be id-safe, so anything unusual is folded.
  return `shadow-${objectId.replace(/[^A-Za-z0-9_-]/g, '-')}`;
}

/**
 * Split a colour into an SVG `flood-color` plus an optional `flood-opacity`.
 * `feDropShadow` takes the two separately, and the shadow presets express their
 * colours as `rgba(...)`, which not every renderer honours in `flood-color`.
 */
function splitShadowColor(color: string): {
  color: string;
  opacity?: number;
} {
  const match = /^rgba\(\s*([^)]+)\)$/i.exec(color.trim());
  if (!match) {
    return { color };
  }
  const parts = match[1].split(',').map((p) => p.trim());
  if (parts.length !== 4) {
    return { color };
  }
  const [r, g, b, a] = parts;
  const alpha = Number(a);
  return {
    color: `rgb(${r}, ${g}, ${b})`,
    ...(Number.isFinite(alpha) ? { opacity: alpha } : {}),
  };
}

/**
 * A drop-shadow filter for one text object. Shadows are chained as successive
 * `feDropShadow` primitives, so a multi-shadow preset (engraved) survives.
 */
function textFilterFor(obj: CalligraphyTextObject, id: string): string {
  const primitives = (obj.shadows ?? [])
    .map((s) => {
      const { color, opacity } = splitShadowColor(s.color);
      const alpha = opacity === undefined ? '' : ` flood-opacity="${opacity}"`;
      return (
        `<feDropShadow dx="${s.offsetX}" dy="${s.offsetY}"` +
        ` stdDeviation="${s.blur}" flood-color="${escapeXml(color)}"${alpha} />`
      );
    })
    .join('');
  // A generous region keeps large blurs from being clipped at the text box.
  return (
    `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">` +
    `${primitives}</filter>`
  );
}

/** Unique font families needed to render this project's text objects. */
export function collectUsedFamilies(project: MidadProject): string[] {
  const set = new Set<string>();
  for (const obj of project.objects) {
    if (obj.type === 'text') {
      set.add(familyForKey(obj.fontKey));
    }
  }
  return [...set];
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Resolve TTF bytes for each requested family into data URIs for @font-face
 * embedding. On web, Metro resolves font assets to URIs we can fetch. On
 * native, the require() id is resolved through expo-asset. Failures degrade
 * gracefully: that family is simply not embedded.
 */
export async function collectSvgFontFaces(
  families: string[],
): Promise<SvgFontFace[]> {
  const out: SvgFontFace[] = [];
  for (const family of families) {
    try {
      const asset = (fontAssets as Record<string, unknown>)[family];
      if (typeof asset === 'string') {
        const res = await fetch(asset);
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        out.push({
          family,
          dataUri: `data:font/ttf;base64,${bytesToBase64(new Uint8Array(buf))}`,
        });
      } else if (asset != null) {
        const a = Asset.fromModule(asset as number);
        if (!a.downloaded) {
          await a.downloadAsync();
        }
        if (!a.localUri) continue;
        const { File } = await import('expo-file-system');
        const f = new File(a.localUri);
        const raw = await f.bytes();
        out.push({
          family,
          dataUri: `data:font/ttf;base64,${bytesToBase64(raw)}`,
        });
      }
    } catch {
      // Skip unembeddable fonts.
    }
  }
  return out;
}

function transformAttr(t: {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
}): string {
  const sx = t.flipH ? -t.scale : t.scale;
  const sy = t.flipV ? -t.scale : t.scale;
  return `translate(${t.x} ${t.y}) rotate(${t.rotation}) scale(${sx} ${sy})`;
}

/** Fill/stroke attributes mirroring fillOrStrokePaint's visibility rules. Returns null when invisible. */
function shapePaintAttrs(
  shape: ShapeObject,
  strokeWidth?: number,
): string | null {
  const sw = strokeWidth ?? shape.strokeWidth ?? 1;
  if (strokeWidth === undefined && !shape.fill && sw <= 0) {
    return null;
  }
  const color = escapeXml(shape.color);
  if (strokeWidth !== undefined || !shape.fill) {
    return `fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"`;
  }
  return `fill="${color}"`;
}

function shapeToSvg(shape: ShapeObject): string | null {
  const size = SHAPE_BASE_SIZE;
  const geometry = shapeGeometryToSvg(shape, size);
  if (!geometry) {
    return null;
  }
  // Geometry is authored in a `0..size` box in local units; the enclosing <g>
  // supplies the object's scale, and this shift centres the box on the origin.
  return `<g transform="translate(${-size / 2} ${-size / 2})">${geometry}</g>`;
}

/** Shape geometry inside a `0..size` box, mirrored by the Skia renderer. */
function shapeGeometryToSvg(shape: ShapeObject, size: number): string | null {
  switch (shape.shapeKey) {
    case 'circle': {
      const attrs = shapePaintAttrs(shape);
      if (!attrs) return null;
      return `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - SHAPE_INSET}" ${attrs} />`;
    }
    case 'square': {
      const attrs = shapePaintAttrs(shape);
      if (!attrs) return null;
      return `<rect x="${SHAPE_INSET}" y="${SHAPE_INSET}" width="${size - SHAPE_INSET * 2}" height="${size - SHAPE_INSET * 2}" ${attrs} />`;
    }
    case 'ring': {
      const attrs = shapePaintAttrs(shape, (shape.strokeWidth ?? 2) * 2);
      return `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 3}" ${attrs} />`;
    }
    case 'line': {
      const attrs = shapePaintAttrs(shape, (shape.strokeWidth ?? 2) * 2);
      return `<line x1="2" y1="${size / 2}" x2="${size - 2}" y2="${size / 2}" ${attrs} />`;
    }
    default: {
      const build = SHAPE_PATH_BUILDERS[shape.shapeKey];
      if (!build) return null;
      const attrs = shapePaintAttrs(shape);
      if (!attrs) return null;
      const join = attrs.includes('fill="none"')
        ? ' stroke-linejoin="round"'
        : '';
      return `<path d="${build(size)}"${join} ${attrs} />`;
    }
  }
}

/**
 * Glyph geometry centred on the object origin.
 *
 * Catalog paths are authored in their own font-unit ink box, so they need both
 * an aspect-preserving fit into the square base box and a shift that centres the
 * result. `glyphPlacement` folds those into one translate + scale pair, matching
 * the Skia renderer exactly.
 */
function glyphToSvg(glyph: GlyphObject): string | null {
  const entry = getGlyphEntry(glyph.glyphKey);
  if (!entry) {
    return null;
  }
  const size = SHAPE_BASE_SIZE;
  const p = glyphPlacement(entry, size);
  return (
    `<g transform="translate(${-size / 2} ${-size / 2})">` +
    `<path d="${entry.d}" fill="${escapeXml(glyph.color)}" ` +
    `transform="translate(${p.offsetX} ${p.offsetY}) scale(${p.scale})" />` +
    `</g>`
  );
}

/**
 * Render a text object as a centred stack of `<tspan>` lines. `lines` are the
 * visual lines (soft wraps already resolved by the caller), so a narrowed text
 * box exports the same line breaks the canvas shows.
 */
function textToSvg(
  lines: string[],
  fontSize: number,
  lineHeight: number,
  color: string,
  filterId?: string,
): string {
  const sample = lines.join(' ');
  const isArabic = /[\u0600-\u06FF]/.test(sample);
  const rtl = isArabic ? ' direction="rtl" unicode-bidi="plaintext"' : '';
  const filterAttr = filterId ? ` filter="url(#${filterId})"` : '';
  const dy0 = -((lines.length - 1) * lineHeight) / 2;
  const spans = lines
    .map(
      (line, i) =>
        `<tspan x="0" dy="${i === 0 ? dy0 : lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join('');
  return (
    `<text x="0" y="0" text-anchor="middle" dominant-baseline="middle"` +
    ` font-size="${fontSize}" fill="${escapeXml(color)}"${filterAttr}${rtl}>${spans}</text>`
  );
}

/**
 * Serialize a project document to standalone SVG. Text uses real <text>
 * elements (shaped correctly by any browser honoring the embedded
 * @font-face); some desktop design tools may substitute fonts.
 *
 * `lineBreaks` holds the visual lines per text-object id (see
 * `textLineBreaks`). It is required to reproduce soft-wrapped text, since SVG
 * cannot re-flow a string on its own; when absent, only explicit newlines are
 * honored.
 */
export function projectToSvg(
  project: MidadProject,
  fontFaces: SvgFontFace[] = [],
  lineBreaks: Record<string, string[]> = {},
): string {
  const W = project.canvas.width;
  const H = project.canvas.height;

  // Filters are discovered while walking the objects, so <defs> is assembled
  // after the body loop below.
  const styleSheet =
    fontFaces.length > 0
      ? `<style>${fontFaces
          .map(
            (f) =>
              `@font-face{font-family:'${f.family}';src:url("${f.dataUri}") format("truetype");}`,
          )
          .join('')}</style>`
      : '';

  const bg = project.canvas.background;
  const bgRect =
    bg.type === 'transparent'
      ? ''
      : bg.type === 'image' && bg.imageUri
        ? `<image href="${escapeXml(bg.imageUri)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" />`
        : `<rect width="${W}" height="${H}" fill="${bg.type === 'paper' ? escapeXml(bg.color ?? '#F7F6F3') : '#FFFFFF'}" />`;

  const sorted = [...project.objects].sort((a, b) => a.zIndex - b.zIndex);
  const body: string[] = [];
  const filters: string[] = [];
  for (const obj of sorted) {
    let inner: string | null;
    if (obj.type === 'text') {
      let filterId: string | undefined;
      if (obj.shadows?.length) {
        filterId = shadowFilterId(obj.id);
        filters.push(textFilterFor(obj, filterId));
      }
      inner = textToSvg(
        lineBreaks[obj.id] ?? obj.text.split('\n'),
        obj.fontSize,
        obj.lineHeight,
        obj.color,
        filterId,
      );
    } else if (obj.type === 'shape') {
      inner = shapeToSvg(obj);
    } else {
      inner = glyphToSvg(obj);
    }
    if (!inner) continue;
    const opacity = obj.opacity ?? 1;
    const opacityAttr = opacity < 1 ? ` opacity="${opacity}"` : '';
    body.push(
      `<g transform="${transformAttr(obj.transform)}"${opacityAttr}>${inner}</g>`,
    );
  }

  const defsBody = `${styleSheet}${filters.join('')}`;

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `${defsBody ? `<defs>${defsBody}</defs>` : ''}${bgRect}${body.join('')}</svg>\n`
  );
}
