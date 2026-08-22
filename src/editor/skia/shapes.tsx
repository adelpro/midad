import { Circle, Group, Line, Path, Rect, vec } from '@shopify/react-native-skia';

import { buildStarPath, buildTrianglePath } from '@/editor/skia/shape-geometry';
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
      return <Circle c={center} r={size / 2 - 1} color={color} style={stroke ? 'stroke' : 'fill'} strokeWidth={stroke?.width} />;
    case 'square':
      return <Rect x={1} y={1} width={size - 2} height={size - 2} color={color} style={stroke ? 'stroke' : 'fill'} strokeWidth={stroke?.width} />;
    case 'ring':
      return <Circle c={center} r={size / 3} color={color} style="stroke" strokeWidth={(stroke?.width ?? 2) * 2} />;
    case 'line':
      return <Line p1={vec(2, size / 2)} p2={vec(size - 2, size / 2)} color={color} strokeWidth={(stroke?.width ?? 2) * 2} strokeCap="round" />;
    case 'triangle':
      return <Path path={buildTrianglePath(size)} color={color} style={stroke ? 'stroke' : 'fill'} strokeWidth={stroke?.width} strokeJoin="round" />;
    case 'star':
      return <Path path={buildStarPath(size)} color={color} style={stroke ? 'stroke' : 'fill'} strokeWidth={stroke?.width} strokeJoin="round" />;
    default:
      return <Group />;
  }
}