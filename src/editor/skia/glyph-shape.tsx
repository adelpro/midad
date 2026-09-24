import type { SkCanvas, SkPath } from '@shopify/react-native-skia';
import {
  Group,
  PaintStyle,
  Path,
  Skia,
  StrokeJoin,
} from '@shopify/react-native-skia';

import {
  getGlyphEntry,
  glyphPlacement,
  glyphStrokeWidth,
  glyphStyleOf,
} from '@/editor/glyphs';
import type { GlyphObject } from '@/storage/project-schema';

/**
 * Parsed paths are cached: the catalog is static, SVG path parsing is not cheap,
 * and the same handful of ornaments is redrawn on every frame.
 */
const pathCache = new Map<string, SkPath | null>();

/** Parsed `SkPath` for a catalog key, or null when the key is unknown. */
export function glyphPath(key: string): SkPath | null {
  const cached = pathCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const entry = getGlyphEntry(key);
  const path = entry ? Skia.Path.MakeFromSVGString(entry.d) : null;
  pathCache.set(key, path);
  return path;
}

export type GlyphRenderProps = {
  glyph: GlyphObject;
  size: number;
};

/**
 * Render a glyph centred in a `size` box, preserving its ink aspect ratio.
 * Unknown keys render nothing, matching how ShapeRenderer handles them.
 *
 * The paint follows `glyphStyleOf(glyph)`: `solid` fills the Amiri outline
 * (the heavy, traditional look), while `outline` and `thin` stroke it at the
 * shared `glyphStrokeWidth` for the style. All four paint sites switch on the
 * same field so they cannot drift.
 */
export function GlyphRenderer({ glyph, size }: GlyphRenderProps) {
  const entry = getGlyphEntry(glyph.glyphKey);
  if (!entry) {
    return null;
  }
  const style = glyphStyleOf(glyph);
  const p = glyphPlacement(entry, size);
  return (
    <Group
      transform={[
        { translateX: p.offsetX },
        { translateY: p.offsetY },
        { scale: p.scale },
      ]}
    >
      {style === 'solid' ? (
        <Path path={entry.d} color={glyph.color} />
      ) : (
        <Path
          path={entry.d}
          color={glyph.color}
          style="stroke"
          strokeWidth={glyphStrokeWidth(entry, style)}
          strokeJoin="round"
        />
      )}
    </Group>
  );
}

/**
 * Imperative counterpart to `<GlyphRenderer>` for offscreen rendering,
 * mirroring the shape renderer's contract: draws into a `0..size` box.
 */
export function drawGlyphOnCanvas(
  canvas: SkCanvas,
  glyph: GlyphObject,
  size: number,
): void {
  const entry = getGlyphEntry(glyph.glyphKey);
  if (!entry) {
    return;
  }
  const path = glyphPath(entry.key);
  if (!path) {
    return;
  }
  const style = glyphStyleOf(glyph);
  const p = glyphPlacement(entry, size);
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(glyph.color));
  // The style decides paint: solid fills the outline, outline/thin stroke it —
  // see GlyphRenderer. Widths are in font units, so the canvas scale below
  // sizes them with the path.
  paint.setStyle(style === 'solid' ? PaintStyle.Fill : PaintStyle.Stroke);
  paint.setStrokeWidth(glyphStrokeWidth(entry, style));
  paint.setStrokeJoin(StrokeJoin.Round);
  canvas.save();
  canvas.translate(p.offsetX, p.offsetY);
  canvas.scale(p.scale, p.scale);
  canvas.drawPath(path, paint);
  canvas.restore();
}
