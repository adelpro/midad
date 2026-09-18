import type { SkCanvas, SkPath } from '@shopify/react-native-skia';
import { Group, Path, Skia } from '@shopify/react-native-skia';

import { getGlyphEntry, glyphPlacement } from '@/editor/glyphs';
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
 */
export function GlyphRenderer({ glyph, size }: GlyphRenderProps) {
  const entry = getGlyphEntry(glyph.glyphKey);
  if (!entry) {
    return null;
  }
  const p = glyphPlacement(entry, size);
  return (
    <Group
      transform={[
        { translateX: p.offsetX },
        { translateY: p.offsetY },
        { scale: p.scale },
      ]}
    >
      <Path path={entry.d} color={glyph.color} />
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
  const p = glyphPlacement(entry, size);
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(glyph.color));
  canvas.save();
  canvas.translate(p.offsetX, p.offsetY);
  canvas.scale(p.scale, p.scale);
  canvas.drawPath(path, paint);
  canvas.restore();
}
