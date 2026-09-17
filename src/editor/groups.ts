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
 * exist to hold: **a selection is always a union of whole groups.** A group can
 * therefore never be half-selected, which is what lets the existing group drag,
 * `nudgeSelected`, `removeObjects`, `duplicateObjects` and `alignSelected` treat
 * a group as one element without knowing that groups exist.
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
