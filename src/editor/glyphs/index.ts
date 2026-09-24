/**
 * Glyph catalog accessors and geometry.
 *
 * Skia-free by design: the library sheet renders its thumbnails with
 * `react-native-svg`, so this module must stay importable from plain UI code.
 * The Skia-side renderer lives in `@/editor/skia/glyph-shape`.
 */
import {
  GLYPH_CATALOG,
  type GlyphCatalogEntry,
  type GlyphGroup,
} from '@/editor/glyphs/catalog';

export type {
  GlyphBox,
  GlyphCatalogEntry,
  GlyphGroup,
} from '@/editor/glyphs/catalog';

/** Lookup index, built once — the generated catalog is a static array. */
const BY_KEY: ReadonlyMap<string, GlyphCatalogEntry> = new Map(
  GLYPH_CATALOG.map((entry) => [entry.key, entry]),
);

/**
 * Resolve a persisted `GlyphObject.glyphKey`.
 * Returns null for unknown keys so a project referencing a retired glyph still
 * loads and simply renders nothing.
 */
export function getGlyphEntry(key: string): GlyphCatalogEntry | null {
  return BY_KEY.get(key) ?? null;
}

/** Entries belonging to a group, in catalog order. */
export function glyphsInGroup(group: GlyphGroup): GlyphCatalogEntry[] {
  return GLYPH_CATALOG.filter((entry) => entry.group === group);
}

/** The entry's padded ink box as an SVG `viewBox` string. */
export function glyphViewBox(entry: GlyphCatalogEntry): string {
  const { x, y, w, h } = entry.box;
  return `${x} ${y} ${w} ${h}`;
}

/**
 * Line weight of an ornament, as a fraction of its longest ink side.
 *
 * Ornaments are font outlines mined from Amiri, and a filled outline reads as a
 * heavy solid silhouette. Stroking it instead turns each glyph into calligraphic
 * line-art. Expressing the width as a fraction of `max(w, h)` — rather than a
 * fixed number of font units — is what keeps the line weight constant across the
 * catalog: `glyphPlacement` fits that same longest side to the square base box,
 * so the fraction becomes a fixed share of the box (and of the object once its
 * transform scales it), whether the glyph is a 326-unit fatha or a 1950-unit
 * seen.
 */
export const GLYPH_STROKE_RATIO = 0.04;

/**
 * Stroke width in **font units**, for use inside a glyph's fitted transform (or
 * directly against its font-unit path in the library tile). Every glyph paint
 * site — live canvas, PNG, SVG and the library preview — reads this one value so
 * they cannot drift.
 */
export function glyphStrokeWidth(entry: GlyphCatalogEntry): number {
  return GLYPH_STROKE_RATIO * Math.max(entry.box.w, entry.box.h, 1);
}

export interface GlyphPlacement {
  /** Uniform scale that fits the glyph inside a `size` square. */
  scale: number;
  /** Translation that centres the fitted glyph in that square. */
  offsetX: number;
  offsetY: number;
  /** Rendered ink size after fitting. */
  width: number;
  height: number;
}

/**
 * Fit a glyph inside a `size`×`size` square, preserving its aspect ratio.
 *
 * Glyph ink boxes are tight crops in font units and their aspects vary widely
 * (0.16 for alef, 3.20 for maddah), so they must be letterboxed rather than
 * stretched. Folding the aspect fit and the re-centring into a single scale +
 * translate pair lets every renderer apply the same two operations, which is
 * what keeps the canvas, the PNG export and the SVG export in agreement.
 */
export function glyphPlacement(
  entry: GlyphCatalogEntry,
  size: number,
): GlyphPlacement {
  const { x, y, w, h } = entry.box;
  const scale = size / Math.max(w, h, 1);
  return {
    scale,
    offsetX: (size - w * scale) / 2 - x * scale,
    offsetY: (size - h * scale) / 2 - y * scale,
    width: w * scale,
    height: h * scale,
  };
}
