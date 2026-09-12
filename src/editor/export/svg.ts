import { Asset } from "expo-asset";

import {
  buildStarPath,
  buildTrianglePath,
  SHAPE_BASE_SIZE,
} from "@/editor/skia/shape-geometry";
import type { MidadProject, ShapeObject } from "@/storage/project-schema";
import { calligraphyFonts, fontAssets } from "@/theme";

export interface SvgFontFace {
  family: string;
  dataUri: string;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function familyForKey(fontKey: string): string {
  const entry = calligraphyFonts.find((f) => f.key === fontKey);
  return entry ? entry.family : "Amiri";
}

/** Unique font families needed to render this project's text objects. */
export function collectUsedFamilies(project: MidadProject): string[] {
  const set = new Set<string>();
  for (const obj of project.objects) {
    if (obj.type === "text") {
      set.add(familyForKey(obj.fontKey));
    }
  }
  return [...set];
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
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
      if (typeof asset === "string") {
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
        const { File } = await import("expo-file-system");
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
  // Mirrors EditorCanvas: box already includes scale, and the wrapping <g>
  // applies the transform scale again — identical to the Skia path.
  const size = SHAPE_BASE_SIZE * (shape.transform.scale || 1);
  switch (shape.shapeKey) {
    case "circle": {
      const attrs = shapePaintAttrs(shape);
      if (!attrs) return null;
      return `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" ${attrs} />`;
    }
    case "square": {
      const attrs = shapePaintAttrs(shape);
      if (!attrs) return null;
      return `<rect x="1" y="1" width="${size - 2}" height="${size - 2}" ${attrs} />`;
    }
    case "ring": {
      const attrs = shapePaintAttrs(shape, (shape.strokeWidth ?? 2) * 2);
      return `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 3}" ${attrs} />`;
    }
    case "line": {
      const attrs = shapePaintAttrs(shape, (shape.strokeWidth ?? 2) * 2);
      return `<line x1="2" y1="${size / 2}" x2="${size - 2}" y2="${size / 2}" ${attrs} />`;
    }
    case "triangle":
    case "star": {
      const attrs = shapePaintAttrs(shape);
      if (!attrs) return null;
      const d =
        shape.shapeKey === "star"
          ? buildStarPath(size)
          : buildTrianglePath(size);
      const join = attrs.includes('fill="none"')
        ? ' stroke-linejoin="round"'
        : "";
      return `<path d="${d}"${join} ${attrs} />`;
    }
    default:
      return null;
  }
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
  outline?: { color: string; width: number },
): string {
  const sample = lines.join(" ");
  const isArabic = /[\u0600-\u06FF]/.test(sample);
  const rtl = isArabic ? ' direction="rtl" unicode-bidi="plaintext"' : "";
  const outlineAttrs = outline
    ? ` stroke="${escapeXml(outline.color)}" stroke-width="${outline.width}" paint-order="stroke"`
    : "";
  const dy0 = -((lines.length - 1) * lineHeight) / 2;
  const spans = lines
    .map(
      (line, i) =>
        `<tspan x="0" dy="${i === 0 ? dy0 : lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");
  return (
    `<text x="0" y="0" text-anchor="middle" dominant-baseline="middle"` +
    ` font-size="${fontSize}" fill="${escapeXml(color)}"${outlineAttrs}${rtl}>${spans}</text>`
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

  const defs =
    fontFaces.length > 0
      ? `<defs><style>${fontFaces
          .map(
            (f) =>
              `@font-face{font-family:'${f.family}';src:url("${f.dataUri}") format("truetype");}`,
          )
          .join("")}</style></defs>`
      : "";

  const bg = project.canvas.background;
  const bgRect =
    bg.type === "transparent"
      ? ""
      : `<rect width="${W}" height="${H}" fill="${bg.type === "paper" ? escapeXml(bg.color ?? "#F7F6F3") : "#FFFFFF"}" />`;

  const sorted = [...project.objects].sort((a, b) => a.zIndex - b.zIndex);
  const body: string[] = [];
  for (const obj of sorted) {
    if (obj.type === "glyph") continue;
    const inner =
      obj.type === "text"
        ? textToSvg(
            lineBreaks[obj.id] ?? obj.text.split("\n"),
            obj.fontSize,
            obj.lineHeight,
            obj.color,
            obj.outline,
          )
        : shapeToSvg(obj);
    if (!inner) continue;
    body.push(`<g transform="${transformAttr(obj.transform)}">${inner}</g>`);
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `${defs}${bgRect}${body.join("")}</svg>\n`
  );
}
