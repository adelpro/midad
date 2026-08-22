import { PaintStyle, Skia, StrokeCap } from '@shopify/react-native-skia';
import type { SkCanvas, SkPaint } from '@shopify/react-native-skia';

import type { ShapeObject } from '@/storage/project-schema';

/** Base box size (design units) a shape is rendered into before its transform. */
export const SHAPE_BASE_SIZE = 120;

export function buildStarPath(size: number): string {
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

export function buildTrianglePath(size: number): string {
  const h = size * 0.86;
  return `M ${size / 2} ${(size - h) / 2} L ${size - 2} ${size - 2} L 2 ${size - 2} Z`;
}

/** Mirrors ShapeRenderer visibility rules: invisible when hollow with no stroke width. */
function fillOrStrokePaint(shape: ShapeObject): SkPaint | null {
  const strokeWidth = shape.strokeWidth ?? 1;
  if (!shape.fill && strokeWidth <= 0) {
    return null;
  }
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(shape.color));
  if (shape.fill) {
    paint.setStyle(PaintStyle.Fill);
  } else {
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(strokeWidth);
  }
  return paint;
}

function strokeOnlyPaint(shape: ShapeObject, width: number): SkPaint {
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(shape.color));
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeWidth(width);
  paint.setStrokeCap(StrokeCap.Round);
  return paint;
}

/**
 * Draw a shape object into a `size`×`size` box on an imperative canvas,
 * matching the declarative <ShapeRenderer> output exactly.
 */
export function drawShapeOnCanvas(canvas: SkCanvas, shape: ShapeObject, size: number): void {
  switch (shape.shapeKey) {
    case 'circle': {
      const p = fillOrStrokePaint(shape);
      if (!p) return;
      canvas.drawCircle(size / 2, size / 2, size / 2 - 1, p);
      return;
    }
    case 'square': {
      const p = fillOrStrokePaint(shape);
      if (!p) return;
      canvas.drawRect(Skia.XYWHRect(1, 1, size - 2, size - 2), p);
      return;
    }
    case 'ring': {
      canvas.drawCircle(size / 2, size / 2, size / 3, strokeOnlyPaint(shape, (shape.strokeWidth ?? 2) * 2));
      return;
    }
    case 'line': {
      canvas.drawLine(2, size / 2, size - 2, size / 2, strokeOnlyPaint(shape, (shape.strokeWidth ?? 2) * 2));
      return;
    }
    case 'triangle':
    case 'star': {
      const p = fillOrStrokePaint(shape);
      if (!p) return;
      const d = shape.shapeKey === 'star' ? buildStarPath(size) : buildTrianglePath(size);
      const path = Skia.Path.MakeFromSVGString(d);
      if (!path) return;
      canvas.drawPath(path, p);
      return;
    }
    default:
      return;
  }
}
