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

/**
 * Returns the top-most object (highest zIndex) under a point, or null.
 * Objects are given in z-order; we iterate from the back and return the first
 * (deepest-last drawn = top-most visual) hit.
 */
export function hitTest(
  objects: SizedObject[],
  x: number,
  y: number,
): string | null {
  // Iterate front-to-back (highest z first).
  const sorted = [...objects].sort((a, b) => b.zIndex - a.zIndex);
  for (const o of sorted) {
    const t = o.transform;
    // Center of the object box.
    const cx = t.x;
    const cy = t.y;
    const hw = o.box.width / 2;
    const hh = o.box.height / 2;
    if (Math.abs(x - cx) <= hw && Math.abs(y - cy) <= hh) {
      return o.id;
    }
  }
  return null;
}
