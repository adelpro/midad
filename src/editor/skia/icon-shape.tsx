/**
 * Imported icons, rendered into a `0..size` box like a shape or a glyph.
 *
 * The icon's stored geometry is in its own `viewBox` units, so every renderer
 * scales from that space into the box. The scale lives here, once, because the
 * live canvas, the PNG export and the SVG export must agree about it — the same
 * reason `shape-geometry.ts` owns `SHAPE_BASE_SIZE`.
 */

import { Group, Path, Skia, type SkPath } from '@shopify/react-native-skia';

import { IMAGE_BASE_SIZE } from '@/editor/skia/image-shape';
import type { IconObject } from '@/storage/project-schema';

/**
 * Scale a point from the icon's viewBox into a `size`-unit box.
 *
 * `size` is passed explicitly rather than read from a constant so the caller's
 * own box — which is `IMAGE_BASE_SIZE` on the live canvas — is the authority.
 */
export function iconScaleFor(
  viewBox: { width: number; height: number },
  size: number,
): number {
  const longest = Math.max(viewBox.width, viewBox.height);
  return longest > 0 ? size / longest : 1;
}

/**
 * One icon's paths as Skia path objects, in viewBox units.
 *
 * A path whose `d` the parser rejects is **skipped**, not thrown: the geometry
 * came out of a document, and a design must still open if one of its paths is
 * malformed. `null` is what `MakeFromSVGString` returns for junk.
 */
export function skiaPathsFor(icon: IconObject): SkPath[] {
  const paths: SkPath[] = [];
  for (const entry of icon.paths) {
    const path = Skia.Path.MakeFromSVGString(entry.d);
    if (path) {
      paths.push(path);
    }
  }
  return paths;
}

/**
 * The live canvas's icon renderer.
 *
 * `react-native-skia`'s `<Path>` takes SVG path data directly, so the canvas
 * needs no parse step; the group's scale maps the viewBox into the box and the
 * `-size/2` translate centres it, matching the shape and glyph renderers.
 */
export function IconRenderer({
  icon,
  size,
}: {
  icon: IconObject;
  size: number;
}) {
  const scale = iconScaleFor(icon.viewBox, size);
  return (
    <Group transform={[{ scale }]}>
      {icon.paths.map((entry, index) => (
        <Path
          key={index}
          path={entry.d}
          color={icon.color}
          // Skia's default is nonzero; only the other case needs stating.
          {...(entry.fillRule === 'evenodd'
            ? { fillType: 'evenOdd' as const }
            : {})}
        />
      ))}
    </Group>
  );
}

/** The box an icon occupies before its transform — square, like a shape. */
export const ICON_BASE_SIZE = IMAGE_BASE_SIZE;
