import type { DesignObject } from "@/storage/project-schema";

export interface SizedObject {
  id: string;
  transform: DesignObject["transform"];
  zIndex: number;
  box: { width: number; height: number };
}

/**
 * Identifiers for the resize handles around a selection box, plus the rotation
 * grip that sits above it.
 */
export type ResizeHandle =
  | "nw"
  | "n"
  | "ne"
  | "w"
  | "e"
  | "sw"
  | "s"
  | "se"
  | "rotate";

/** Distance (design units) between a box edge and its handle center. */
export const SELECTION_HANDLE_PAD = 4;

/** Gap (design units) between the box top edge and the rotate grip. */
export const ROTATE_HANDLE_GAP = 26;

/** Smallest object scale used when converting design units into local units. */
const MIN_OBJECT_SCALE = 0.05;

function safeObjectScale(objectScale: number): number {
  return Math.max(MIN_OBJECT_SCALE, Math.abs(objectScale) || 1);
}

/**
 * Selection chrome is authored in design units so it stays a constant size on
 * screen. The overlay draws inside the object's transform group and the gesture
 * layer works in the object's local frame, so both divide by the object's scale
 * to place it. Keeping the two in step is what stops the rotate grip from
 * crowding — and swallowing — the resize handles on a scaled-down object.
 */
export function selectionPad(objectScale = 1): number {
  return SELECTION_HANDLE_PAD / safeObjectScale(objectScale);
}

/** Rotate-grip gap in the object's local frame. See `selectionPad`. */
export function rotateGap(objectScale = 1): number {
  return ROTATE_HANDLE_GAP / safeObjectScale(objectScale);
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
  objectScale = 1,
): ResizeHandlePoint[] {
  const pad = selectionPad(objectScale);
  const hw = box.width / 2 + pad;
  const hh = box.height / 2 + pad;
  return [
    { handle: "nw", x: -hw, y: -hh },
    { handle: "w", x: -hw, y: 0 },
    { handle: "sw", x: -hw, y: hh },
    { handle: "n", x: 0, y: -hh },
    { handle: "s", x: 0, y: hh },
    { handle: "ne", x: hw, y: -hh },
    { handle: "e", x: hw, y: 0 },
    { handle: "se", x: hw, y: hh },
  ];
}

/** True for the four corner handles, which resize proportionally. */
export function isCornerHandle(handle: ResizeHandle): boolean {
  return (
    handle === "nw" || handle === "ne" || handle === "sw" || handle === "se"
  );
}

/** True for the east/west edge handles, which drive horizontal resize. */
export function isHorizontalHandle(handle: ResizeHandle): boolean {
  return handle === "e" || handle === "w";
}

/** True for the rotation grip. */
export function isRotateHandle(handle: ResizeHandle): boolean {
  return handle === "rotate";
}

/**
 * Position of the rotation grip, above the box's top edge in the object's local
 * frame. It is drawn inside the object's transform group, so it follows the
 * object's rotation and flips together with the eight resize handles.
 */
export function rotateHandle(
  box: { width: number; height: number },
  objectScale = 1,
): { x: number; y: number } {
  return {
    x: 0,
    y: -(box.height / 2 + selectionPad(objectScale) + rotateGap(objectScale)),
  };
}

/** The transform fields needed to map between design space and an object's frame. */
export type TransformFrame = Pick<
  DesignObject["transform"],
  "x" | "y" | "scale" | "rotation" | "flipH" | "flipV"
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
 */
export function hitTest(
  objects: SizedObject[],
  x: number,
  y: number,
): string | null {
  // Iterate front-to-back (highest z first).
  const sorted = [...objects].sort((a, b) => b.zIndex - a.zIndex);
  for (const o of sorted) {
    const local = toLocalPoint(o.transform, x, y);
    if (
      Math.abs(local.x) <= o.box.width / 2 &&
      Math.abs(local.y) <= o.box.height / 2
    ) {
      return o.id;
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
export function visualHalfExtents(o: SizedObject): {
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
export function objectAabb(o: SizedObject): Aabb {
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
