import { Circle, Group, Line, Path, Rect, vec } from '@shopify/react-native-skia';

import { SHAPE_INSET, SHAPE_PATH_BUILDERS } from '@/editor/skia/shape-geometry';
import type { ShapeObject } from '@/storage/project-schema';

export type ShapeRenderProps = {
  shape: ShapeObject;
  size: number;
};

/** Render a decorative shape object (fill or stroke) centered in a `size` box. */
export function ShapeRenderer({ shape, size }: ShapeRenderProps) {
  const color = shape.color;
  const strokeWidth = shape.strokeWidth ?? 1;
  const center = vec(size / 2, size / 2);

  if (!shape.fill && strokeWidth <= 0) {
    return null;
  }

  const stroke = shape.fill ? undefined : { color, width: strokeWidth };

  switch (shape.shapeKey) {
    case 'circle':
      return <Circle c={center} r={size / 2 - SHAPE_INSET} color={color} style={stroke ? 'stroke' : 'fill'} strokeWidth={stroke?.width} />;
    case 'square':
      return <Rect x={SHAPE_INSET} y={SHAPE_INSET} width={size - SHAPE_INSET * 2} height={size - SHAPE_INSET * 2} color={color} style={stroke ? 'stroke' : 'fill'} strokeWidth={stroke?.width} />;
    case 'ring':
      return <Circle c={center} r={size / 3} color={color} style="stroke" strokeWidth={(stroke?.width ?? 2) * 2} />;
    case 'line':
      return <Line p1={vec(2, size / 2)} p2={vec(size - 2, size / 2)} color={color} strokeWidth={(stroke?.width ?? 2) * 2} strokeCap="round" />;
    default: {
      // Shared with the PNG renderer and the SVG exporter — one table, so a new
      // path shape cannot exist on the canvas but vanish from an export.
      const build = SHAPE_PATH_BUILDERS[shape.shapeKey];
      if (!build) {
        return <Group />;
      }
      return <Path path={build(size)} color={color} style={stroke ? 'stroke' : 'fill'} strokeWidth={stroke?.width} strokeJoin="round" />;
    }
  }
}