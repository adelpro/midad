import type { SkCanvas, SkPaint } from '@shopify/react-native-skia';
import { PaintStyle, Skia, StrokeCap } from '@shopify/react-native-skia';

import type { ShapeKey, ShapeObject } from '@/storage/project-schema';

/** Base box size (design units) a shape is rendered into before its transform. */
export const SHAPE_BASE_SIZE = 120;

/**
 * Clearance between a shape's ink and the edge of its base box (design units).
 *
 * The box-filling shapes used to run right up to the edge, which left a stroked
 * circle flush with its own selection rectangle — the stroke even spilled a unit
 * past the box. Every shape now keeps this much air, so an object reads as an
 * ornament sitting inside its box rather than as a box that happens to be round.
 */
export const SHAPE_INSET = 8;

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

const f = (v: number): string => v.toFixed(2);

/** Regular polygon inscribed in the inset box, first vertex pointing up. */
function buildRegularPolygon(size: number, sides: number): string {
  const r = size / 2 - SHAPE_INSET;
  const c = size / 2;
  const points: string[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (2 * Math.PI * i) / sides - Math.PI / 2;
    points.push(
      `${i === 0 ? 'M' : 'L'} ${f(c + r * Math.cos(a))} ${f(c + r * Math.sin(a))}`,
    );
  }
  return `${points.join(' ')} Z`;
}

export function buildPentagonPath(size: number): string {
  return buildRegularPolygon(size, 5);
}

/** Pointy-top hexagon: taller than it is wide, so it needs no extra inset. */
export function buildHexagonPath(size: number): string {
  return buildRegularPolygon(size, 6);
}

/**
 * A square with its corners cut, which is what reads as an octagon and fills the
 * box on the flats; the 45° corners give it the horizontal air automatically.
 */
export function buildOctagonPath(size: number): string {
  const a = SHAPE_INSET;
  const b = size - SHAPE_INSET;
  const cut = (b - a) / (2 + Math.SQRT2);
  return (
    `M ${f(a + cut)} ${f(a)} L ${f(b - cut)} ${f(a)} ` +
    `L ${f(b)} ${f(a + cut)} L ${f(b)} ${f(b - cut)} ` +
    `L ${f(b - cut)} ${f(b)} L ${f(a + cut)} ${f(b)} ` +
    `L ${f(a)} ${f(b - cut)} L ${f(a)} ${f(a + cut)} Z`
  );
}

/** Rhombus touching the middle of each side of the inset box. */
export function buildDiamondPath(size: number): string {
  const a = SHAPE_INSET;
  const b = size - SHAPE_INSET;
  const mid = size / 2;
  return `M ${f(mid)} ${f(a)} L ${f(b)} ${f(mid)} L ${f(mid)} ${f(b)} L ${f(a)} ${f(mid)} Z`;
}

/**
 * Lune between the box circle and a smaller disc pushed off-centre.
 *
 * The two circles cross at `(cx + x, cy ± y)`, so the outline walks the long way
 * round the outer circle and returns along the inner one — two arcs, no
 * approximation, and identical in Skia and SVG.
 */
export function buildCrescentPath(size: number): string {
  const c = size / 2;
  const outer = size / 2 - SHAPE_INSET;
  const inner = outer * 0.78;
  const shift = outer * 0.34;
  const x = (shift * shift + outer * outer - inner * inner) / (2 * shift);
  const y = Math.sqrt(Math.max(outer * outer - x * x, 0));
  const top = `${f(c + x)} ${f(c - y)}`;
  const bottom = `${f(c + x)} ${f(c + y)}`;
  return (
    `M ${top} A ${f(outer)} ${f(outer)} 0 1 0 ${bottom} ` +
    `A ${f(inner)} ${f(inner)} 0 0 0 ${top} Z`
  );
}

/**
 * Mihrab profile: a straight body under a semicircular head of half the span.
 * The springing line sits one radius below the box top, which is what puts the
 * apex exactly on the inset edge.
 */
export function buildArchPath(size: number): string {
  const a = SHAPE_INSET;
  const b = size - SHAPE_INSET;
  const mid = size / 2;
  const r = (b - a) / 2;
  const spring = b - r;
  return (
    `M ${f(a)} ${f(b)} L ${f(a)} ${f(spring)} ` +
    `A ${f(r)} ${f(r)} 0 0 1 ${f(mid)} ${f(spring - r)} ` +
    `A ${f(r)} ${f(r)} 0 0 1 ${f(b)} ${f(spring)} ` +
    `L ${f(b)} ${f(b)} Z`
  );
}

/**
 * Path-based shapes, keyed by `shapeKey`.
 *
 * `circle`, `square`, `ring` and `line` are primitives that each renderer draws
 * natively; everything else is a path, and this single table feeds the
 * declarative Skia renderer, the imperative PNG renderer and the SVG
 * serializer. That is the point: the three used to repeat the same switch, so a
 * new shape could easily land in one and be missing from the other two.
 */
export const SHAPE_PATH_BUILDERS: Partial<
  Record<ShapeKey, (size: number) => string>
> = {
  triangle: buildTrianglePath,
  star: buildStarPath,
  diamond: buildDiamondPath,
  pentagon: buildPentagonPath,
  hexagon: buildHexagonPath,
  octagon: buildOctagonPath,
  crescent: buildCrescentPath,
  arch: buildArchPath,
};

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
export function drawShapeOnCanvas(
  canvas: SkCanvas,
  shape: ShapeObject,
  size: number,
): void {
  switch (shape.shapeKey) {
    case 'circle': {
      const p = fillOrStrokePaint(shape);
      if (!p) return;
      canvas.drawCircle(size / 2, size / 2, size / 2 - SHAPE_INSET, p);
      return;
    }
    case 'square': {
      const p = fillOrStrokePaint(shape);
      if (!p) return;
      canvas.drawRect(
        Skia.XYWHRect(
          SHAPE_INSET,
          SHAPE_INSET,
          size - SHAPE_INSET * 2,
          size - SHAPE_INSET * 2,
        ),
        p,
      );
      return;
    }
    case 'ring': {
      canvas.drawCircle(
        size / 2,
        size / 2,
        size / 3,
        strokeOnlyPaint(shape, (shape.strokeWidth ?? 2) * 2),
      );
      return;
    }
    case 'line': {
      canvas.drawLine(
        2,
        size / 2,
        size - 2,
        size / 2,
        strokeOnlyPaint(shape, (shape.strokeWidth ?? 2) * 2),
      );
      return;
    }
    default: {
      const build = SHAPE_PATH_BUILDERS[shape.shapeKey];
      if (!build) return;
      const p = fillOrStrokePaint(shape);
      if (!p) return;
      const path = Skia.Path.MakeFromSVGString(build(size));
      if (!path) return;
      canvas.drawPath(path, p);
      return;
    }
  }
}
