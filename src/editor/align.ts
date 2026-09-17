import { groupAabb, type Aabb, type SizedObject } from "@/editor/hit-test";

/**
 * Alignment / centring operations for the current selection.
 *
 * `left`/`centerH`/`right` and `top`/`middleV`/`bottom` are relative to the
 * selection's own bounding box (the classic editor behaviour: the outermost
 * *element* stays put and the others move to meet it). `canvasCenterH`/`V` move
 * the selection onto the canvas centre, and work for a single object too.
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
 * New centres for every object in the selection, one update per object.
 *
 * `units` is the selection split into elements — one group, or one lone object
 * (see `groups.ts`). Two consequences follow:
 *
 * - The relative modes (`left` … `bottom`) align the **elements**: the outermost
 *   element is the target and each element moves as a whole, so a group keeps
 *   its internal arrangement instead of collapsing onto its own outermost
 *   member. A lone object is a one-object unit, which is why a plain
 *   multi-selection aligns exactly as it always has.
 * - `canvasCenterH`/`V` translate the whole selection by the distance between
 *   its bounding box and the canvas centre. For a single object — the common
 *   case — that is the same thing as centring the object, because
 *   `transform.x/y` *is* the object's own centre.
 *
 * Objects are translated rather than resized, so a rotated object is moved by
 * the difference between its rotated bounding box and the target edge — the
 * same box the user sees drawn around it.
 */
export function computeAlignUpdates(
  mode: AlignMode,
  units: SizedObject[][],
  canvas: { width: number; height: number },
): AlignUpdate[] {
  const selected = units.flat();
  if (selected.length === 0) {
    return [];
  }

  const bounds = groupAabb(selected);
  if (!bounds) {
    return [];
  }

  // Centring moves the selection as one: the delta is measured once, on the
  // selection's own box, and every object shifts by it.
  if (mode === "canvasCenterH" || mode === "canvasCenterV") {
    const dx =
      mode === "canvasCenterH"
        ? canvas.width / 2 - (bounds.left + bounds.right) / 2
        : 0;
    const dy =
      mode === "canvasCenterV"
        ? canvas.height / 2 - (bounds.top + bounds.bottom) / 2
        : 0;
    return selected.map((o) => ({
      id: o.id,
      transform: { x: o.transform.x + dx, y: o.transform.y + dy },
    }));
  }

  const targetX = edgeTarget(mode, "x", bounds);
  const targetY = edgeTarget(mode, "y", bounds);
  if (targetX === null && targetY === null) {
    return [];
  }

  const updates: AlignUpdate[] = [];
  for (const unit of units) {
    const unitBounds = groupAabb(unit);
    if (!unitBounds) {
      continue;
    }
    // `?? target` yields a zero delta; the mode only ever affects one axis.
    const dx =
      targetX === null
        ? 0
        : targetX - (edgeTarget(mode, "x", unitBounds) ?? targetX);
    const dy =
      targetY === null
        ? 0
        : targetY - (edgeTarget(mode, "y", unitBounds) ?? targetY);
    for (const o of unit) {
      updates.push({
        id: o.id,
        transform: { x: o.transform.x + dx, y: o.transform.y + dy },
      });
    }
  }
  return updates;
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
