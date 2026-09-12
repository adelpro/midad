import {
  groupAabb,
  objectAabb,
  type Aabb,
  type SizedObject,
} from "@/editor/hit-test";

/**
 * Alignment / centring operations for the current selection.
 *
 * `left`/`centerH`/`right` and `top`/`middleV`/`bottom` are relative to the
 * selection's own bounding box (the classic editor behaviour: the outermost
 * object stays put and the others move to meet it). `canvasCenterH`/`V` move
 * every selected object's centre onto the canvas centre, and work for a single
 * object too.
 */
export type AlignMode =
  | "left"
  | "centerH"
  | "right"
  | "top"
  | "middleV"
  | "bottom"
  | "canvasCenterH"
  | "canvasCenterV";

/** A translation to apply to one object. */
export interface AlignUpdate {
  id: string;
  transform: { x: number; y: number };
}

/**
 * New centers for every selected object that satisfies `mode`.
 *
 * Objects are translated rather than resized, so a rotated object is moved by
 * the difference between its rotated bounding box and the target edge — the
 * same box the user sees drawn around it.
 */
export function computeAlignUpdates(
  mode: AlignMode,
  selected: SizedObject[],
  canvas: { width: number; height: number },
): AlignUpdate[] {
  if (selected.length === 0) {
    return [];
  }

  // Centring on the canvas needs no group bounds: `transform.x/y` *is* the
  // object's own centre (rotation happens about it), so it is already the
  // value we want.
  if (mode === "canvasCenterH") {
    return selected.map((o) => ({
      id: o.id,
      transform: { x: canvas.width / 2, y: o.transform.y },
    }));
  }
  if (mode === "canvasCenterV") {
    return selected.map((o) => ({
      id: o.id,
      transform: { x: o.transform.x, y: canvas.height / 2 },
    }));
  }

  const bounds = groupAabb(selected);
  if (!bounds) {
    return [];
  }
  const targetX = edgeTarget(mode, "x", bounds);
  const targetY = edgeTarget(mode, "y", bounds);
  if (targetX === null && targetY === null) {
    return [];
  }

  return selected.map((o) => {
    const box = objectAabb(o);
    // `?? target` yields a zero delta; the mode only ever affects one axis.
    const dx =
      targetX === null ? 0 : targetX - (edgeTarget(mode, "x", box) ?? targetX);
    const dy =
      targetY === null ? 0 : targetY - (edgeTarget(mode, "y", box) ?? targetY);
    return {
      id: o.id,
      transform: { x: o.transform.x + dx, y: o.transform.y + dy },
    };
  });
}

/**
 * Coordinate of the edge/centre `mode` refers to on one axis, or null when the
 * mode does not act on that axis (e.g. `top` on the x axis).
 */
function edgeTarget(
  mode: AlignMode,
  axis: "x" | "y",
  box: Aabb,
): number | null {
  if (axis === "x") {
    switch (mode) {
      case "left":
        return box.left;
      case "centerH":
        return (box.left + box.right) / 2;
      case "right":
        return box.right;
      default:
        return null;
    }
  }
  switch (mode) {
    case "top":
      return box.top;
    case "middleV":
      return (box.top + box.bottom) / 2;
    case "bottom":
      return box.bottom;
    default:
      return null;
  }
}
