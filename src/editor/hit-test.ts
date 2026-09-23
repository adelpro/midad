import type { DesignObject } from '@/storage/project-schema';

export interface SizedObject {
  id: string;
  /**
   * Collection membership, published with the measured box so the chrome can
   * resolve a whole selection's frame without walking the document again.
   */
  groupId?: string;
  transform: DesignObject['transform'];
  zIndex: number;
  box: { width: number; height: number };
}

/**
 * Identifiers for the resize handles around a selection box, plus the rotation
 * grip that sits above it.
 */
export type ResizeHandle =
  'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se' | 'rotate';

/**
 * Distance (screen pt) between a box edge and its handle centre.
 *
 * Every chrome constant here is a **screen** length, never a design length.
 * The chrome is drawn inside the fit-to-view group and, for a single object,
 * inside that object's own transform group, so a length only stays the size the
 * user sees if the view scale *and* the object scale are divided out on the way
 * in. Failing to divide the view scale was what put the handles on a phone's
 * box edge (1.2 pt off it at a fit scale of 0.3) while the strokes stayed 4 pt.
 */
export const SELECTION_HANDLE_PAD = 6;

/** Gap (screen pt) between the box top edge and the rotate grip. */
export const ROTATE_HANDLE_GAP = 30;

/** Radius (screen pt) of the drawn rotate grip. */
export const ROTATE_GRIP_RADIUS = 7;

/**
 * Grab tolerance (screen pt) around an object's box: a press this far outside
 * the drawn edge is still accepted, so a thin text line or a small shape stays
 * easy to grab.
 *
 * It lives here so the tap hit-test and the pointer-down drag path cannot
 * disagree about where an object starts — both go through `pickObject` below.
 */
export const OBJECT_HIT_PAD = 10;

/**
 * Touch radius (screen pt) around a resize handle. 22 pt is DESIGN.md's
 * non-negotiable 44×44 minimum, expressed as a radius.
 */
export const HANDLE_TOUCH_RADIUS = 22;

/** Touch radius (screen pt) around the rotate grip — a lone handle, so wider. */
export const ROTATE_TOUCH_RADIUS = 26;

/**
 * Fraction of the box's own half-extents inside which a press belongs to the
 * *object* rather than to one of its handles.
 *
 * The touch radii are deliberately far larger than the drawn handles, so on a
 * small object they cover the whole box. Without this rule a press in the middle
 * of such an object would resize it instead of moving it — the one thing a
 * generous touch target must not break. It is a fraction, not a length, so the
 * behaviour is identical at every zoom.
 *
 * The rotate grip sits outside the box, so it clears this test on its own.
 */
const RIM_FRACTION = 0.55;

/** Smallest object scale used when converting design units into local units. */
const MIN_OBJECT_SCALE = 0.05;

/** Smallest `unit` the chrome maths will divide by. */
const MIN_UNIT = 0.02;

/**
 * The object's scale, guarded against zero and near-zero so callers can divide
 * by it. Zero maps to 1 — the same shortcut `toLocalPoint` takes, so a press and
 * a box can never disagree about a degenerate scale.
 */
export function safeObjectScale(objectScale: number): number {
  return Math.max(MIN_OBJECT_SCALE, Math.abs(objectScale) || 1);
}

/**
 * `unit` is the factor that maps a length in a frame's own units to screen pt:
 * `viewport.scale` for chrome drawn beside the objects, multiplied by the
 * object's own scale for chrome drawn inside one object's transform group.
 * Guarded so an unmeasured view (`scale: 1` before the first layout) or a
 * degenerate object can never produce `Infinity`.
 */
export function safeUnit(unit: number): number {
  return Math.max(MIN_UNIT, Math.abs(unit) || 1);
}

/**
 * Selection chrome is authored in screen pt so it stays a constant size on
 * screen. Both the overlay and the gesture layer work in a frame's own units,
 * so both divide by `unit` to place it. Keeping the two in step is what stops
 * the rotate grip from crowding — and swallowing — the resize handles on a
 * scaled-down object.
 */
export function selectionPad(unit = 1): number {
  return SELECTION_HANDLE_PAD / safeUnit(unit);
}

/** Rotate-grip gap in a frame's own units. See `selectionPad`. */
function rotateGap(unit = 1): number {
  return ROTATE_HANDLE_GAP / safeUnit(unit);
}

export interface ResizeHandlePoint {
  handle: ResizeHandle;
  x: number;
  y: number;
}

/**
 * The eight resize handles in an object's local (unrotated, unscaled) frame,
 * centered on the object box. Shared by the gesture hit-test and the on-canvas
 * selection overlay so both agree on where the handles are.
 */
export function resizeHandles(
  box: { width: number; height: number },
  unit = 1,
): ResizeHandlePoint[] {
  const pad = selectionPad(unit);
  const hw = box.width / 2 + pad;
  const hh = box.height / 2 + pad;
  return [
    { handle: 'nw', x: -hw, y: -hh },
    { handle: 'w', x: -hw, y: 0 },
    { handle: 'sw', x: -hw, y: hh },
    { handle: 'n', x: 0, y: -hh },
    { handle: 's', x: 0, y: hh },
    { handle: 'ne', x: hw, y: -hh },
    { handle: 'e', x: hw, y: 0 },
    { handle: 'se', x: hw, y: hh },
  ];
}

/** True for the four corner handles, which resize proportionally. */
export function isCornerHandle(handle: ResizeHandle): boolean {
  return (
    handle === 'nw' || handle === 'ne' || handle === 'sw' || handle === 'se'
  );
}

/** True for the east/west edge handles, which drive horizontal resize. */
export function isHorizontalHandle(handle: ResizeHandle): boolean {
  return handle === 'e' || handle === 'w';
}

/** True for the rotation grip. */
export function isRotateHandle(handle: ResizeHandle): boolean {
  return handle === 'rotate';
}

/**
 * Position of the rotation grip, above the box's top edge in the object's local
 * frame. It is drawn inside the object's transform group, so it follows the
 * object's rotation and flips together with the eight resize handles.
 */
export function rotateHandle(
  box: { width: number; height: number },
  unit = 1,
): { x: number; y: number } {
  return {
    x: 0,
    y: -(box.height / 2 + selectionPad(unit) + rotateGap(unit)),
  };
}

/** The transform fields needed to map between design space and an object's frame. */
export type TransformFrame = Pick<
  DesignObject['transform'],
  'x' | 'y' | 'scale' | 'rotation' | 'flipH' | 'flipV'
>;

/**
 * Map a design-space point into an object's local (unrotated, unscaled) frame.
 * This is the exact inverse of the canvas transform `translate · rotate · scale`,
 * so a box expressed in local units can be tested against it directly.
 *
 * Shared by the selection hit-test and the gesture layer so the two can never
 * disagree about where an object's box is — including when that object is
 * scaled, flipped or rotated.
 */
export function toLocalPoint(
  transform: TransformFrame,
  x: number,
  y: number,
): { x: number; y: number } {
  const rot = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  const dx = x - transform.x;
  const dy = y - transform.y;
  const ux = dx * cos - dy * sin;
  const uy = dx * sin + dy * cos;
  const scaleX = transform.flipH ? -transform.scale : transform.scale;
  const scaleY = transform.flipV ? -transform.scale : transform.scale;
  return { x: ux / (scaleX || 1), y: uy / (scaleY || 1) };
}

/**
 * Returns the top-most object (highest zIndex) under a point, or null.
 *
 * `SizedObject.box` is measured in the object's local units, so the point is
 * mapped into each object's frame before testing. Comparing the box against the
 * raw design-space point would ignore the object's scale and rotation, making
 * scaled or rotated objects selectable only near their centre.
 *
 * `unit` maps the view's pt to design units (`viewport.scale`), so the grab
 * tolerance is a constant `OBJECT_HIT_PAD` **screen** pt per object: dividing it
 * by `unit × |object scale|` turns it into that object's local units. It is the
 * one object-hit rule, shared by the tap path and the pointer-down drag path, so
 * the two accept the same press.
 */
export function pickObject(
  objects: SizedObject[],
  x: number,
  y: number,
  unit = 1,
): SizedObject | null {
  const u = safeUnit(unit);
  // Iterate front-to-back (highest z first).
  const sorted = [...objects].sort((a, b) => b.zIndex - a.zIndex);
  for (const o of sorted) {
    const local = toLocalPoint(o.transform, x, y);
    const pad = OBJECT_HIT_PAD / (u * safeObjectScale(o.transform.scale));
    if (
      Math.abs(local.x) <= o.box.width / 2 + pad &&
      Math.abs(local.y) <= o.box.height / 2 + pad
    ) {
      return o;
    }
  }
  return null;
}

/** The id of the top-most object under a point (`pickObject`), or null. */
export function hitTest(
  objects: SizedObject[],
  x: number,
  y: number,
  unit = 1,
): string | null {
  return pickObject(objects, x, y, unit)?.id ?? null;
}

/**
 * The handles in the order they are allowed to win a press: the rotate grip can
 * never be shadowed by a resize handle, and a corner always beats an edge, which
 * is what stops a press on a short object's corner from grabbing the `e` handle
 * and re-flowing its text instead of scaling it.
 */
const HANDLE_TIERS: readonly (readonly ResizeHandle[])[] = [
  ['rotate'],
  ['nw', 'ne', 'sw', 'se'],
  ['n', 's', 'e', 'w'],
];

/**
 * The handle under a point, or null when the press belongs to the object body.
 *
 * `transform`/`box` describe a frame in its own units and `unit` maps those
 * units to screen pt, so `HANDLE_TOUCH_RADIUS / unit` is a constant touch target
 * on screen at every zoom — the same conversion that places the drawn handles.
 * The nearest handle inside the winning tier wins; see `HANDLE_TIERS` and
 * `RIM_FRACTION`.
 */
export function pickHandle(
  transform: TransformFrame,
  box: { width: number; height: number },
  unit: number,
  p: { x: number; y: number },
): ResizeHandle | null {
  const u = safeUnit(unit);
  const local = toLocalPoint(transform, p.x, p.y);
  const hw = Math.max(1e-6, box.width / 2);
  const hh = Math.max(1e-6, box.height / 2);
  // The interior of the box always moves the object; only the rim is up for
  // grabs. See `RIM_FRACTION`.
  const onRim =
    Math.abs(local.x) / hw >= RIM_FRACTION ||
    Math.abs(local.y) / hh >= RIM_FRACTION;
  if (!onRim) {
    return null;
  }

  const points: ResizeHandlePoint[] = [
    { handle: 'rotate', ...rotateHandle(box, u) },
    ...resizeHandles(box, u),
  ];
  for (const tier of HANDLE_TIERS) {
    let best: ResizeHandle | null = null;
    let bestDist = Infinity;
    for (const point of points) {
      if (!tier.includes(point.handle)) {
        continue;
      }
      const dist = Math.hypot(local.x - point.x, local.y - point.y);
      const radius =
        (isRotateHandle(point.handle)
          ? ROTATE_TOUCH_RADIUS
          : HANDLE_TOUCH_RADIUS) / u;
      if (dist <= radius && dist < bestDist) {
        bestDist = dist;
        best = point.handle;
      }
    }
    if (best) {
      return best;
    }
  }
  return null;
}

/** Axis-aligned bounding box in design units (origin top-left, y grows down). */
export interface Aabb {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Half-extents of an object's *visual* box in design units.
 *
 * Both the renderer and the selection overlay draw the object box inside the
 * object's own transform group, so the drawn extent is the stored box scaled by
 * `transform.scale` — true for every object type. Alignment and centring must
 * use this rather than the raw box, otherwise they would disagree with what the
 * user actually sees on a scaled object.
 */
function visualHalfExtents(o: SizedObject): {
  hw: number;
  hh: number;
} {
  const s = Math.abs(o.transform.scale) || 1;
  return { hw: (o.box.width / 2) * s, hh: (o.box.height / 2) * s };
}

/**
 * Axis-aligned bounding box of one object, widened to contain the object's
 * rotated visual box (the standard rotated-rectangle extent).
 */
function objectAabb(o: SizedObject): Aabb {
  const { hw, hh } = visualHalfExtents(o);
  const rad = (o.transform.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const ex = hw * cos + hh * sin;
  const ey = hw * sin + hh * cos;
  return {
    left: o.transform.x - ex,
    top: o.transform.y - ey,
    right: o.transform.x + ex,
    bottom: o.transform.y + ey,
  };
}

/** Union AABB of several objects, or null when the list is empty. */
export function groupAabb(objects: SizedObject[]): Aabb | null {
  if (objects.length === 0) {
    return null;
  }
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const o of objects) {
    const b = objectAabb(o);
    if (b.left < left) left = b.left;
    if (b.top < top) top = b.top;
    if (b.right > right) right = b.right;
    if (b.bottom > bottom) bottom = b.bottom;
  }
  return { left, top, right, bottom };
}

/**
 * A box the selection chrome can be drawn around, in *design* units.
 *
 * Two things separate it from a `SizedObject`: the half-extents are already
 * visual (`|scale|` folded in), and it carries an orientation. That is what lets
 * one overlay serve both a single object and a whole collection — a collection
 * has no transform of its own to nest the chrome inside.
 *
 * Structurally identical to `CollectionFrame` in `groups.ts`, which owns the
 * maths that derives a collection's frame; that module cannot import this one
 * (the check script transpiles it standalone), so the shape is declared twice.
 */
export interface SelectionFrame {
  /** Centre, design units. */
  x: number;
  y: number;
  /** Half-extents, design units (visual, not local). */
  hw: number;
  hh: number;
  /** Orientation in degrees. */
  rotation: number;
}

/** The frame as the box `resizeHandles` / `rotateHandle` expect. */
export function frameBox(frame: SelectionFrame): {
  width: number;
  height: number;
} {
  return { width: frame.hw * 2, height: frame.hh * 2 };
}

/**
 * The frame as a `TransformFrame`, so `toLocalPoint` and the gesture layer's
 * `localOffset` accept it unchanged. `scale: 1` because the half-extents are
 * already visual — this is also what keeps the shared chrome geometry
 * (`selectionPad`, `rotateGap`, the hit radii) measured in design units.
 */
export function frameTransform(frame: SelectionFrame): TransformFrame {
  return {
    x: frame.x,
    y: frame.y,
    scale: 1,
    rotation: frame.rotation,
    flipH: false,
    flipV: false,
  };
}
