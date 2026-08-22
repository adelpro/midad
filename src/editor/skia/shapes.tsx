import { Circle, Group, Line, Path, Rect, vec } from '@shopify/react-native-skia';

import type { ShapeObject } from '@/storage/project-schema';

export type ShapeRenderProps = {
  shape: ShapeObject;
  size: number;
};

function buildStarPath(size: number): string {
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2;
  const inner = outer * 0.45;
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  points.push('Z');
  return points.join(' ');
}

function buildTrianglePath(size: number): string {
  const h = size * 0.86;
  return `M ${size / 2} ${(size - h) / 2} L ${size - 2} ${size - 2} L 2 ${size - 2} Z`;
}

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