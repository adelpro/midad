/**
 * Group membership: the pure logic behind "these objects are one element".
 *
 * A group is a set of objects the editor selects, moves, duplicates, restyles
 * and reorders together. Membership is a single optional `groupId` on the object
 * (`GroupMember` in the project schema) rather than a container type, so the
 * document model stays flat: hit-testing, gestures, rendering and both export
 * paths go on seeing an ordinary list of objects.
 *
 * Everything the feature does follows from one invariant, which these functions
 * exist to hold: **a selection is a union of whole collections — except that at
 * most one collection may be *entered*, in which case exactly one of its members
 * is selected.** A collection can therefore never be half-selected, which is what
 * lets the group drag, `nudgeSelected`, `removeObjects`, `duplicateObjects` and
 * `alignSelected` treat a collection as one element without knowing that
 * collections exist. The single entered exception is what lets a split word go on
 * being edited letter by letter.
 *
 * A collection is one `groupId`'s worth of objects. A split word is a collection
 * too — `splitObjectIntoParts` stamps one — with `part` kept as provenance: the
 * reading order, and what rejoin needs to rebuild the text.
 *
 * Deliberately free of imports — `scripts/check-groups.mjs` transpiles this
 * module standalone and cannot resolve the `@/` alias. The structural
 * `Groupable` interface is what buys that freedom: every caller's object type
 * already satisfies it without this module knowing about `DesignObject`.
 */

/** The only shape this module needs from a design object. */
export interface Groupable {
  id: string;
  groupId?: string;
}

/** Are these two id lists the same, element for element? */
export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** Id of every object that belongs to `groupId`, in document order. */
export function groupMemberIds<T extends Groupable>(
  objects: readonly T[],
  groupId: string,
): string[] {
  const ids: string[] = [];
  for (const o of objects) {
    if (o.groupId === groupId) {
      ids.push(o.id);
    }
  }
  return ids;
}

/**
 * Grow a selection so that every group it touches is selected whole.
 *
 * The *touched* id leads and its group's other members follow in document order,
 * which keeps `selectedIds[0]` — the primary every single-object read uses — on
 * the object the user actually pointed at. An id with no group is passed through
 * untouched, so a plain multi-selection keeps the order it was built in.
 *
 * Always returns a new array; callers that must not notify subscribers bail with
 * `sameIds` instead.
 */
export function expandToGroups<T extends Groupable>(
  ids: readonly string[],
  objects: readonly T[],
): string[] {
  const expanded: string[] = [];
  const taken = new Set<string>();
  const byId = new Map(objects.map((o) => [o.id, o]));

  for (const id of ids) {
    if (taken.has(id)) {
      continue;
    }
    taken.add(id);
    expanded.push(id);

    const obj = byId.get(id);
    if (!obj || obj.groupId === undefined) {
      // An id the document does not hold is kept as it was: it can name no
      // members, and dropping it would silently shrink a caller's selection.
      continue;
    }
    for (const member of objects) {
      if (member.groupId === obj.groupId && !taken.has(member.id)) {
        taken.add(member.id);
        expanded.push(member.id);
      }
    }
  }
  return expanded;
}

/**
 * The selection split into units, where one unit is one group or one lone
 * object. A unit lists only the ids that are *selected*, so a caller can never
 * be handed an object the user has not picked.
 *
 * This is what makes "a group is one element" concrete: align and the count
 * badge work on units, while the store's `selectedIds` stays a flat id list.
 */
export function selectionUnits<T extends Groupable>(
  ids: readonly string[],
  objects: readonly T[],
): string[][] {
  const selected = new Set(ids);
  const units: string[][] = [];
  const seenGroups = new Set<string>();

  for (const id of ids) {
    const obj = objects.find((o) => o.id === id);
    if (!obj) {
      continue;
    }
    if (obj.groupId === undefined) {
      units.push([id]);
      continue;
    }
    if (seenGroups.has(obj.groupId)) {
      continue;
    }
    seenGroups.add(obj.groupId);
    units.push(
      objects
        .filter((o) => o.groupId === obj.groupId && selected.has(o.id))
        .map((o) => o.id),
    );
  }
  return units;
}

/** How many elements the selection is made of. A group counts as one. */
export function unitCount<T extends Groupable>(
  ids: readonly string[],
  objects: readonly T[],
): number {
  return selectionUnits(ids, objects).length;
}

/**
 * Grouping needs at least two elements and no nesting: a selection that already
 * contains a grouped object must be ungrouped first. One owner per object keeps
 * membership a single field, with no parent chain to walk.
 */
export function canGroup<T extends Groupable>(
  ids: readonly string[],
  objects: readonly T[],
): boolean {
  if (ids.length < 2) {
    return false;
  }
  const byId = new Map(objects.map((o) => [o.id, o]));
  let count = 0;
  for (const id of ids) {
    const obj = byId.get(id);
    if (!obj) {
      return false;
    }
    if (obj.groupId !== undefined) {
      return false;
    }
    count += 1;
  }
  return count >= 2;
}

/**
 * Ungrouping applies to exactly one whole group — nothing loose beside it. The
 * completeness check is defensive: the whole-groups invariant already guarantees
 * it, and a partial group must never be dissolved into a state the rest of the
 * editor does not expect.
 */
export function canUngroup<T extends Groupable>(
  ids: readonly string[],
  objects: readonly T[],
): boolean {
  if (ids.length < 2) {
    return false;
  }
  const byId = new Map(objects.map((o) => [o.id, o]));
  const first = byId.get(ids[0]);
  const groupId = first?.groupId;
  if (groupId === undefined) {
    return false;
  }
  for (const id of ids) {
    if (byId.get(id)?.groupId !== groupId) {
      return false;
    }
  }
  return groupMemberIds(objects, groupId).length === ids.length;
}

/**
 * Drop membership from any group left with fewer than two members.
 *
 * A one-member group is not a group — it would keep the count badge, the
 * group-only actions and the dashed box saying "element" about a single object,
 * and no user could ever produce one on purpose. Deleting, splitting or
 * re-joining a group is what shrinks it, so those three mutations normalise the
 * document on the way out.
 *
 * Returns the **same array identity** when there is nothing to dissolve, because
 * the store's write suppression compares the array it is handed.
 */
export function dissolveSingletonGroups<T extends Groupable>(
  objects: readonly T[],
): readonly T[] {
  const counts = new Map<string, number>();
  for (const o of objects) {
    if (o.groupId !== undefined) {
      counts.set(o.groupId, (counts.get(o.groupId) ?? 0) + 1);
    }
  }
  let lonely = false;
  for (const n of counts.values()) {
    if (n < 2) {
      lonely = true;
      break;
    }
  }
  if (!lonely) {
    return objects;
  }
  return objects.map((o) =>
    o.groupId !== undefined && (counts.get(o.groupId) ?? 0) < 2
      ? // `undefined` rather than removed: `JSON.stringify` drops the key, so
        // history comparison, export and import all see a plain object.
        { ...o, groupId: undefined }
      : o,
  );
}

/**
 * Give a duplicated set of objects its own group.
 *
 * The copy must not share the source's `groupId`, or the two would be one group
 * and dragging either would drag both. A clone that stood alone stays alone; a
 * copy of a single member of a group dissolves back to standalone, because a
 * one-member group is not a group.
 */
export function remapGroupIds<T extends Groupable>(
  clones: readonly T[],
  groupId: string,
): T[] {
  return [
    ...dissolveSingletonGroups(
      clones.map((c) => (c.groupId === undefined ? c : { ...c, groupId })),
    ),
  ];
}

/** A fresh group id, in the shape the editor uses for object ids. */
export function newGroupId(): string {
  return `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ---------------------------------------------------------------------------
// The collection: which objects one selection is made of, and the box around
// them. A split word and a group differ only in what they remember about their
// members — `part` gives a word its reading order and its rejoin — so everything
// below is written once and serves both.
// ---------------------------------------------------------------------------

/** The provenance a split part carries (`TextPartRef` in the project schema). */
export interface PartedMember {
  part?: { index: number };
}

/** What the collection frame maths needs from a sized object. */
export interface FramedMember extends Groupable {
  transform: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
    flipH: boolean;
    flipV: boolean;
  };
  box: { width: number; height: number };
  /**
   * Tight glyph box in the member's local frame, when it has one (a split
   * word's part). The frame measures this instead of the advance/line `box`, so
   * adjacent letters do not draw overlapping boxes. Structurally identical to
   * `InkBox` in `hit-test.ts`, declared here for the same standalone reason.
   */
  ink?: { cx: number; cy: number; width: number; height: number };
}

/**
 * The box the chrome draws around a collection, in design units.
 *
 * Structurally identical to `SelectionFrame` in `hit-test.ts`, which owns the
 * chrome geometry; the two shapes are declared separately because this module
 * must stay importable by the standalone check script (see the header).
 *
 * `hw`/`hh` are *visual* — member scales are already folded in — so the frame
 * carries no scale of its own.
 */
export interface CollectionFrame {
  /** Centre, design units. */
  x: number;
  y: number;
  /** Half-extents, design units. */
  hw: number;
  hh: number;
  /** Orientation in degrees. */
  rotation: number;
}

/** One member's transform, as captured when a collection gesture started. */
export interface MemberOrigin {
  id: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
}

/** The transform fields a collection scale writes. */
export interface CollectionPatch {
  id: string;
  transform: { x: number; y: number; scale: number };
}

/** The transform fields a collection rotation writes. */
export interface CollectionRotatePatch {
  id: string;
  transform: { x: number; y: number; rotation: number };
}

/** The transform fields a collection mirror writes. */
export interface CollectionFlipPatch {
  id: string;
  transform: {
    x: number;
    y: number;
    rotation: number;
    flipH: boolean;
    flipV: boolean;
  };
}

/** Member orientations within this many degrees count as "they agree". */
const ROTATION_EPSILON = 0.01;

/**
 * Bounds a member's own scale is kept inside — by a handle resize, by a
 * collection scale, and by the rail's scale buttons.
 *
 * One definition, because the three must agree: a collection scale clamps its
 * factor so that *no* member leaves these bounds, and a clamp that disagreed with
 * the single-object one would let a handle drag on a collection reach a scale no
 * object can be dragged to.
 */
export const OBJECT_SCALE_BOUNDS = { min: 0.05, max: 20 } as const;

/**
 * The box to draw around a selection, and what kind of box it is.
 *
 * | `state`     | When                                                     | Chrome |
 * | ----------- | -------------------------------------------------------- | ------ |
 * | `"whole"`   | two or more elements — a collection, or a loose selection | handles |
 * | `"entered"` | one member of a collection                                | context box, no handles |
 * | `null`      | one loose object                                          | its own chrome |
 *
 * One function for the canvas, the collection bar and the gesture layer, so the box
 * the user sees, the box the bar points at and the box a press can grab are the
 * same box by construction.
 */
export function selectionFrame<T extends FramedMember>(
  ids: readonly string[],
  sized: readonly T[],
): { frame: CollectionFrame; state: 'whole' | 'entered'; members: T[] } | null {
  const collectionId = selectionCollection(ids, sized);
  if (collectionId !== null) {
    const members = sized.filter((o) => o.groupId === collectionId);
    const frame = collectionFrame(members);
    if (frame === null) {
      return null;
    }
    return { frame, state: ids.length > 1 ? 'whole' : 'entered', members };
  }
  if (ids.length > 1) {
    const members = sized.filter((o) => ids.includes(o.id));
    const frame = collectionFrame(members);
    return frame === null ? null : { frame, state: 'whole', members };
  }
  return null;
}

/**
 * The `groupId` a selection belongs to, or null when it is not one collection.
 *
 * Works for both states: a whole collection (every id shares the id) and an
 * entered one (the single member carries it).
 */
export function selectionCollection<T extends Groupable>(
  ids: readonly string[],
  objects: readonly T[],
): string | null {
  if (ids.length === 0) {
    return null;
  }
  const byId = new Map(objects.map((o) => [o.id, o]));
  let groupId: string | undefined;
  for (const id of ids) {
    const found = byId.get(id)?.groupId;
    if (found === undefined) {
      // A loose object: the selection is a multi-selection, not a collection.
      return null;
    }
    if (groupId === undefined) {
      groupId = found;
    } else if (groupId !== found) {
      // Two collections side by side: still not one collection.
      return null;
    }
  }
  return groupId ?? null;
}

/**
 * The collection the selection is *entered* into, or null while it is whole.
 *
 * Entered is **derived, never stored**: `expandToGroups` grows any selection that
 * touches a collection, so a single selected member can only have got there
 * through an explicit enter (`enterMember`, a member tile, or a second tap on an
 * already-selected member). Deriving it is what keeps undo, redo and
 * `loadProject` needing no extra state at all.
 */
export function enteredCollection<T extends Groupable>(
  ids: readonly string[],
  objects: readonly T[],
): string | null {
  if (ids.length !== 1) {
    return null;
  }
  return objects.find((o) => o.id === ids[0])?.groupId ?? null;
}

/**
 * Members of the collection the selection touches, in reading order.
 *
 * A split word has one (`part.index`); a plain group has only document order.
 * The sort is applied only when *every* member carries a `part`, so a group that
 * happens to contain one split word is never re-ordered by a stray index.
 */
export function collectionMembers<T extends Groupable & PartedMember>(
  ids: readonly string[],
  objects: readonly T[],
): T[] {
  const groupId = selectionCollection(ids, objects);
  if (groupId === null) {
    return [];
  }
  const members = objects.filter((o) => o.groupId === groupId);
  if (members.every((m) => m.part !== undefined)) {
    return [...members].sort(
      (a, b) => (a.part?.index ?? 0) - (b.part?.index ?? 0),
    );
  }
  return [...members];
}

/**
 * The collection's own box: its members' boxes, unioned *in the collection's
 * frame* and then oriented.
 *
 * The orientation is derived, not stored. When every member carries the same
 * rotation the arrangement's own axes are that rotation, so the box is exact —
 * which covers the common cases (a word plus ornaments at 0°, and any collection
 * after a collection rotate, since that adds one delta to every member). When the
 * members disagree there is no honest orientation to draw, so the box falls back
 * to the axis-aligned union of the rotation-widened member boxes, which is what
 * `groupAabb` measures.
 */
export function collectionFrame<T extends FramedMember>(
  members: readonly T[],
): CollectionFrame | null {
  if (members.length === 0) {
    return null;
  }
  const first = members[0].transform.rotation;
  const unanimous = members.every(
    (m) => Math.abs(m.transform.rotation - first) < ROTATION_EPSILON,
  );
  const rotation = unanimous ? first : 0;
  const rad = (rotation * Math.PI) / 180;
  const toFrameCos = Math.cos(-rad);
  const toFrameSin = Math.sin(-rad);

  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const m of members) {
    const s = Math.abs(m.transform.scale) || 1;
    // The member's tight ink box when it has one (a split word's part), else its
    // advance/line box.
    const width = m.ink?.width ?? m.box.width;
    const height = m.ink?.height ?? m.box.height;
    const hw = (width / 2) * s;
    const hh = (height / 2) * s;
    // Seen from the collection's frame, a member is rotated by the difference
    // between the two, and the AABB of a rotated rectangle is |cos|/|sin|
    // weighted.
    const memberRad = ((m.transform.rotation - rotation) * Math.PI) / 180;
    const ex =
      hw * Math.abs(Math.cos(memberRad)) + hh * Math.abs(Math.sin(memberRad));
    const ey =
      hw * Math.abs(Math.sin(memberRad)) + hh * Math.abs(Math.cos(memberRad));
    // The member's visible centre: its own origin plus the ink offset, mapped
    // through its flip, scale and rotation.
    const rotRad = (m.transform.rotation * Math.PI) / 180;
    const lx = (m.ink?.cx ?? 0) * (m.transform.flipH ? -s : s);
    const ly = (m.ink?.cy ?? 0) * (m.transform.flipV ? -s : s);
    const centreX = m.transform.x + lx * Math.cos(rotRad) - ly * Math.sin(rotRad);
    const centreY = m.transform.y + lx * Math.sin(rotRad) + ly * Math.cos(rotRad);
    const ux = centreX * toFrameCos - centreY * toFrameSin;
    const uy = centreX * toFrameSin + centreY * toFrameCos;
    if (ux - ex < left) left = ux - ex;
    if (uy - ey < top) top = uy - ey;
    if (ux + ex > right) right = ux + ex;
    if (uy + ey > bottom) bottom = uy + ey;
  }

  // The box is measured about the design origin, so its centre has to be rotated
  // back out of the frame to land where the user sees it.
  const mx = (left + right) / 2;
  const my = (top + bottom) / 2;
  return {
    x: mx * Math.cos(rad) - my * Math.sin(rad),
    y: mx * Math.sin(rad) + my * Math.cos(rad),
    hw: (right - left) / 2,
    hh: (bottom - top) / 2,
    rotation,
  };
}

/** The frame's top edge midpoint — the collection bar's preferred anchor. */
export function frameTopCentre(frame: CollectionFrame): {
  x: number;
  y: number;
} {
  const rad = (frame.rotation * Math.PI) / 180;
  return {
    x: frame.x + frame.hh * Math.sin(rad),
    y: frame.y - frame.hh * Math.cos(rad),
  };
}

/** The frame's bottom edge midpoint — the bar's fallback anchor. */
export function frameBottomCentre(frame: CollectionFrame): {
  x: number;
  y: number;
} {
  const rad = (frame.rotation * Math.PI) / 180;
  return {
    x: frame.x - frame.hh * Math.sin(rad),
    y: frame.y + frame.hh * Math.cos(rad),
  };
}

/** A point in view px — design space already mapped through the viewport. */
export interface ViewPoint {
  x: number;
  y: number;
}

/** Where the collection bar sits, and which side of the frame it chose. */
export interface CollectionBarPlacement {
  /** Left edge, view px. */
  left: number;
  /** Top edge, view px. */
  top: number;
  /** Which side of the frame the bar ended up on. */
  side: 'above' | 'below';
}

/**
 * Where the collection bar goes: above the frame by preference, below it when
 * the frame sits too close to the top edge, and clamped inside the canvas only
 * when the selection leaves room for neither.
 *
 * The bar replaced a single-line chip on the same anchor, and the clamp that
 * suited a chip does not suit it: a label can sit over the selection, but a row
 * of member tiles would cover the very members it is offering to navigate. So
 * the first choice is whichever side is *clear of the frame*, and the clamp is
 * the last resort for a selection taller than the canvas.
 *
 * `barWidth`/`barHeight` are measured, not constants — the bar's height follows
 * its own content, and the caller has nothing to keep in sync.
 */
export function collectionBarPlacement(args: {
  /** The frame's top edge midpoint, already in view px. */
  topAnchor: ViewPoint;
  /** The frame's bottom edge midpoint, already in view px. */
  bottomAnchor: ViewPoint;
  barWidth: number;
  barHeight: number;
  /** The canvas box, view px. */
  viewW: number;
  viewH: number;
  /** The inset the bar keeps from the canvas edges, view px. */
  margin: number;
  /** The clearance between the bar and the frame edge it sits beside, view px. */
  gap: number;
}): CollectionBarPlacement {
  const {
    topAnchor,
    bottomAnchor,
    barWidth,
    barHeight,
    viewW,
    viewH,
    margin,
    gap,
  } = args;
  // `Math.max` before `Math.min` so a bar wider or taller than the canvas
  // clamps to `margin` instead of inverting the range.
  const maxLeft = Math.max(margin, viewW - barWidth - margin);
  const maxTop = Math.max(margin, viewH - barHeight - margin);
  const left = Math.min(Math.max(topAnchor.x - barWidth / 2, margin), maxLeft);
  const above = topAnchor.y - barHeight - gap;
  if (above >= margin) {
    return { left, top: above, side: 'above' };
  }
  const below = bottomAnchor.y + gap;
  if (below + barHeight <= viewH - margin) {
    return { left, top: below, side: 'below' };
  }
  return {
    left,
    top: Math.min(Math.max(above, margin), maxTop),
    side: 'above',
  };
}

/** Capture the per-member origins a collection gesture transforms absolutely. */
export function memberOrigins(
  members: readonly FramedMember[],
): MemberOrigin[] {
  return members.map((m) => ({
    id: m.id,
    x: m.transform.x,
    y: m.transform.y,
    scale: m.transform.scale,
    rotation: m.transform.rotation,
    flipH: m.transform.flipH,
    flipV: m.transform.flipV,
  }));
}

/**
 * Clamp a collection's scale factor so that **no** member leaves the object scale
 * bounds.
 *
 * Clamping each member independently would move the offsets by one factor and the
 * boxes by another, and the arrangement would come apart; one factor keeps the
 * collection similar. When the members' scales span a wider range than the bounds
 * allow there is no such factor, so the raw `k` is returned and the per-member
 * clamp takes over — the similarity degrades, which is the honest outcome.
 */
export function clampCollectionScale(
  origins: readonly MemberOrigin[],
  k: number,
  bounds: { min: number; max: number },
): number {
  let lower = -Infinity;
  let upper = Infinity;
  for (const o of origins) {
    const s = Math.abs(o.scale) || 1;
    lower = Math.max(lower, bounds.min / s);
    upper = Math.min(upper, bounds.max / s);
  }
  if (!(lower <= upper)) {
    return k;
  }
  return Math.min(upper, Math.max(lower, k));
}

/**
 * Scale a whole collection about a pivot: every offset from the pivot is
 * multiplied by the factor and every member's own scale follows it, so the
 * arrangement stays similar instead of each member growing in place.
 */
export function scaleCollection(
  origins: readonly MemberOrigin[],
  k: number,
  pivot: { x: number; y: number },
  bounds: { min: number; max: number },
): CollectionPatch[] {
  const factor = clampCollectionScale(origins, k, bounds);
  return origins.map((o) => ({
    id: o.id,
    transform: {
      x: pivot.x + (o.x - pivot.x) * factor,
      y: pivot.y + (o.y - pivot.y) * factor,
      scale: Math.min(bounds.max, Math.max(bounds.min, o.scale * factor)),
    },
  }));
}

/**
 * Rotate a whole collection about a pivot: each member orbits the pivot *and*
 * turns by the same delta. Turning them in place would leave the arrangement
 * unchanged on screen, which is what the rail's rotate buttons used to do.
 */
export function rotateCollection(
  origins: readonly MemberOrigin[],
  deltaDeg: number,
  pivot: { x: number; y: number },
): CollectionRotatePatch[] {
  const rad = (deltaDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return origins.map((o) => {
    const dx = o.x - pivot.x;
    const dy = o.y - pivot.y;
    return {
      id: o.id,
      transform: {
        x: pivot.x + dx * cos - dy * sin,
        y: pivot.y + dx * sin + dy * cos,
        rotation: o.rotation + deltaDeg,
      },
    };
  });
}

/**
 * Mirror a whole collection about an axis through a pivot.
 *
 * A mirror is a rotation *and* a flip, so a member's own angle negates while its
 * offset mirrors. Flipping the members in place would leave the arrangement
 * exactly where it was and only turn every letter backwards.
 */
export function flipCollection(
  origins: readonly MemberOrigin[],
  axis: 'h' | 'v',
  pivot: { x: number; y: number },
): CollectionFlipPatch[] {
  return origins.map((o) => ({
    id: o.id,
    transform: {
      x: axis === 'h' ? 2 * pivot.x - o.x : o.x,
      y: axis === 'v' ? 2 * pivot.y - o.y : o.y,
      rotation: -o.rotation,
      flipH: axis === 'h' ? !o.flipH : o.flipH,
      flipV: axis === 'v' ? !o.flipV : o.flipV,
    },
  }));
}
