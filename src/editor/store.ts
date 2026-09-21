import { create } from 'zustand';

import { computeAlignUpdates, type AlignMode } from '@/editor/align';
import {
  canGroup,
  canUngroup,
  dissolveSingletonGroups,
  enteredCollection,
  expandToGroups,
  newGroupId,
  remapGroupIds,
  sameIds,
  selectionUnits,
  type MemberOrigin,
} from '@/editor/groups';
import type { ResizeHandle, SizedObject } from '@/editor/hit-test';
import { NUDGE_COALESCE_MS } from '@/editor/shortcuts';
import type {
  CalligraphyTextObject,
  DesignObject,
  MidadProject,
} from '@/storage/project-schema';

/**
 * Editor document state: the working design, selection, and undo/redo history.
 *
 * History stores immutable snapshots of `objects` (multi-level). A discrete
 * action commits a snapshot; continuous gestures commit on gesture end.
 */

interface Viewport {
  /** Fit-to-view scale (design → view px). */
  scale: number;
  /** Centering offsets in view px. */
  offsetX: number;
  offsetY: number;
  /**
   * The canvas box in view px.
   *
   * Published alongside the transform so an overlay that lives *outside* the
   * Skia tree — the collection bar — can place itself from a design-space point
   * without measuring the canvas a second time.
   */
  w: number;
  h: number;
}

/** An object's center as captured when a drag started. */
export interface DragOrigin {
  id: string;
  x: number;
  y: number;
}

/**
 * One undo step: the objects *and* the selection as they were before the
 * mutation.
 *
 * The selection belongs to the step. A history that only remembers objects
 * strands the user at both ends of it: undoing a delete used to bring the
 * objects back with nothing selected, and undoing an insert used to leave
 * `selectedIds` pointing at an id the restored document does not contain.
 */
interface HistoryEntry {
  objects: DesignObject[];
  selectedIds: string[];
}

/**
 * Non-reactive gesture-interaction scratch state. Lives in the store (not
 * refs) so gesture handlers stay React-Compiler-safe; nothing subscribes to
 * this slice, so mutations never trigger renders.
 */
interface GestureScratch {
  /**
   * Objects captured at drag start with their original centers. A group drag
   * holds one entry per selected object so the whole selection moves together.
   */
  dragOrigins: DragOrigin[];
  /**
   * Set when pointer-down already changed the selection, so the trailing tap
   * does not toggle it a second time.
   */
  selectionHandledOnDown: boolean;
  /**
   * Whether pointer-down resolved the selection *additively* — multi-select
   * mode, or Shift/Cmd/Ctrl on a platform that has them.
   *
   * Recorded here rather than re-read by the trailing tap, so the two halves of
   * a single press cannot disagree about what the press meant.
   */
  additiveSelect: boolean;
  transformTargetId: string | null;
  scaleOrigin: number;
  rotationOrigin: number;
  /**
   * The collection a handle drag is transforming: every member's transform as
   * captured at pointer-down, in the order the drag writes them.
   *
   * Empty for a single-object drag, which is what tells `updateResize` which of
   * the two maths to run — a collection has no object id to key on. The frame
   * the drag is measured in lives in the `resizeOrigin*` fields below, which fit
   * it exactly: centre, rotation, and a box with no scale of its own.
   */
  collectionOrigins: MemberOrigin[];
  /**
   * Degrees the collection has turned so far, relative to `collectionOrigins`.
   * The release settle animates from here to the snapped angle, so it needs the
   * running total rather than the last pointer angle.
   */
  collectionDelta: number;
  /** Object being resized via a handle drag. */
  resizeTargetId: string | null;
  resizeHandle: ResizeHandle | null;
  /** Transform + box of the object as captured when the handle drag started. */
  resizeOriginX: number;
  resizeOriginY: number;
  resizeOriginScale: number;
  resizeOriginRotation: number;
  resizeOriginFlipH: boolean;
  resizeOriginFlipV: boolean;
  resizeOriginBoxW: number;
  resizeOriginBoxH: number;
  /** Pointer position (design units + local units) when the drag started. */
  resizeStartX: number;
  resizeStartY: number;
  resizeStartLocalX: number;
  resizeStartLocalY: number;
  /** Last pointer angle (degrees) seen during a rotation drag. */
  resizeLastAngle: number;
  /** Timestamp (ms) of `resizeLastAngle`, for release-velocity estimation. */
  resizeLastAngleAt: number;
  /** Smoothed angular velocity (deg/s) during a rotation drag. */
  rotateVelocity: number;
  /**
   * The 45° multiple currently magnetized during a rotation drag, or null
   * when the pointer is outside every snap window. Tracked so the snap tick
   * fires once per window entry, not per frame.
   */
  lastSnapAngle: number | null;
  /**
   * Arrow-key nudge burst bookkeeping. The timestamp stops a held key from
   * recording the ~30 history entries per second it auto-repeats at. The anchor
   * is the newest history entry as of the previous press, compared by identity:
   * `snapshot` stores the array it pushed, so a different reference means
   * something else was recorded in between and the burst must not swallow it.
   */
  nudgeBurstAt: number;
  nudgeBurstAnchor: DesignObject[] | null;
}

const EMPTY_SCRATCH: GestureScratch = {
  dragOrigins: [],
  selectionHandledOnDown: false,
  additiveSelect: false,
  transformTargetId: null,
  scaleOrigin: 1,
  rotationOrigin: 0,
  collectionOrigins: [],
  collectionDelta: 0,
  resizeTargetId: null,
  resizeHandle: null,
  resizeOriginX: 0,
  resizeOriginY: 0,
  resizeOriginScale: 1,
  resizeOriginRotation: 0,
  resizeOriginFlipH: false,
  resizeOriginFlipV: false,
  resizeOriginBoxW: 0,
  resizeOriginBoxH: 0,
  resizeStartX: 0,
  resizeStartY: 0,
  resizeStartLocalX: 0,
  resizeStartLocalY: 0,
  resizeLastAngle: 0,
  resizeLastAngleAt: 0,
  rotateVelocity: 0,
  lastSnapAngle: null,
  nudgeBurstAt: 0,
  nudgeBurstAnchor: null,
};

interface EditorState {
  project: MidadProject | null;
  selectedIds: string[];
  /** When on, taps add/remove objects instead of replacing the selection. */
  multiSelectMode: boolean;
  sizedObjects: SizedObject[];
  viewport: Viewport;
  gs: GestureScratch;
  past: HistoryEntry[];
  future: HistoryEntry[];

  loadProject: (project: MidadProject) => void;
  select: (id: string | null, additive?: boolean) => void;
  /**
   * Selects one member of a collection on its own — the *entered* state.
   *
   * Inert for an object that belongs to no collection: there is nothing to enter,
   * and selecting it alone would be an ordinary `select`. Used by the member
   * strip's tiles and by the second-tap-on-a-member idiom.
   */
  enterMember: (id: string) => void;
  /**
   * Leaves an entered collection, selecting the whole of it. Inert when the
   * selection is not entered — there is nothing to come back out of.
   *
   * The counterpart to `enterMember`, and the only way back: a plain `select` on a
   * member while inside keeps you inside, which is what makes stepping between
   * letters work.
   */
  exitCollection: () => void;
  clearSelection: () => void;
  setMultiSelectMode: (enabled: boolean, keepSelection?: boolean) => void;
  setSizedObjects: (objects: SizedObject[]) => void;
  setViewport: (v: Viewport) => void;
  setGs: (patch: Partial<GestureScratch>) => void;

  addObject: (obj: DesignObject) => void;
  updateObject: (id: string, patch: Partial<DesignObject>) => void;
  /**
   * Apply several object patches as ONE store write (one notification). A
   * group drag uses this so N selected objects cost one render per frame
   * instead of N.
   */
  updateObjects: (
    patches: { id: string; patch: Partial<DesignObject> }[],
  ) => void;
  removeObjects: (ids: string[]) => void;
  duplicateObjects: (ids: string[]) => void;
  /**
   * Replace one text object with the parts of a split word, as a single
   * undoable step. Selects the first part, because the editor's handles, the
   * transform bar and the Style navigator all act on one object at a time.
   */
  splitObjectIntoParts: (
    sourceId: string,
    parts: CalligraphyTextObject[],
  ) => void;
  /**
   * Re-compose a complete set of parts into one text object, as a single
   * undoable step.
   */
  mergeObjectParts: (merged: CalligraphyTextObject, partIds: string[]) => void;
  bringToFront: (ids: string[]) => void;
  sendToBack: (ids: string[]) => void;
  /**
   * Makes the selection one group: from now on a tap on any member selects them
   * all, and they move, duplicate, reorder and restyle together. Inert when the
   * selection is not groupable (fewer than two elements, or already grouped —
   * groups do not nest).
   */
  groupSelected: () => void;
  /**
   * Dissolves the selected group back into independent objects. Inert unless the
   * selection is exactly one whole group.
   */
  ungroupSelected: () => void;
  /** Aligns or centres the current selection (see `AlignMode`). */
  alignSelected: (mode: AlignMode) => void;
  /**
   * Moves every selected object by a delta, as one undoable step. Reverts a
   * no-op, and folds the auto-repeat of a held arrow key into a single history
   * entry (see `NUDGE_COALESCE_MS`).
   */
  nudgeSelected: (dx: number, dy: number) => void;
  /** Selects every object in the document. */
  selectAll: () => void;
  /** Push the current objects onto history before a mutation. */
  snapshot: () => void;
  undo: () => void;
  redo: () => void;

  setCanvas: (patch: Partial<MidadProject['canvas']>) => void;
  setGrid: (enabled: boolean) => void;
  /** Updates document metadata without adding a canvas undo step. */
  setProjectName: (name: string) => void;
}

const MAX_HISTORY = 50;

function clone(objects: DesignObject[]): DesignObject[] {
  return objects.map((o) => ({ ...o, transform: { ...o.transform } }));
}

/**
 * A history entry's selection, narrowed to the ids its own objects still hold
 * and then grown back to whole elements.
 *
 * Undoing an insert restores a document that never contained the inserted
 * object, so its id must not come back as a selection the canvas cannot draw
 * handles around. The expansion on the way out is what keeps a restored
 * selection a union of whole groups, the invariant `groups.ts` describes.
 */
function restorableSelection(entry: HistoryEntry): string[] {
  const ids = new Set(entry.objects.map((o) => o.id));
  return expandToGroups(
    entry.selectedIds.filter((id) => ids.has(id)),
    entry.objects,
  );
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  selectedIds: [],
  multiSelectMode: false,
  sizedObjects: [],
  viewport: { scale: 1, offsetX: 0, offsetY: 0, w: 0, h: 0 },
  gs: EMPTY_SCRATCH,
  past: [],
  future: [],

  loadProject: (project) =>
    set({
      project,
      selectedIds: [],
      multiSelectMode: false,
      sizedObjects: [],
      gs: EMPTY_SCRATCH,
      past: [],
      future: [],
    }),

  select: (id, additive = false) => {
    // Collection membership is resolved here, in the one place every selection
    // write funnels through, so a collection can never end up half-selected (see
    // `groups.ts` for the invariant).
    const objects = get().project?.objects ?? [];
    set((s) => {
      if (id == null) {
        // Bail when already empty — a no-op must not allocate a new array
        // (and re-render every selection subscriber) for nothing.
        return s.selectedIds.length === 0 ? s : { selectedIds: [] };
      }
      if (additive) {
        // The element the press resolved to: the object, plus its collection.
        const element = expandToGroups([id], objects);
        // The toggle idiom works on the element, not the object: tapping a
        // member of an already-selected collection takes the whole collection
        // out.
        if (s.selectedIds.includes(id)) {
          const drop = new Set(element);
          const next = s.selectedIds.filter((x) => !drop.has(x));
          return sameIds(next, s.selectedIds) ? s : { selectedIds: next };
        }
        const next = expandToGroups([...s.selectedIds, id], objects);
        return sameIds(next, s.selectedIds) ? s : { selectedIds: next };
      }
      // Inside an entered collection, a press on one of its members moves the
      // focus within it rather than collapsing back to the whole thing. This is
      // the one hole in the whole-collections invariant, and it is what keeps a
      // split word editable letter by letter.
      const entered = enteredCollection(s.selectedIds, objects);
      if (
        entered !== null &&
        objects.find((o) => o.id === id)?.groupId === entered
      ) {
        return s.selectedIds.length === 1 && s.selectedIds[0] === id
          ? s
          : { selectedIds: [id] };
      }
      // The element the press resolved to: the object, plus its collection.
      const element = expandToGroups([id], objects);
      // Same element already selected — bail for the same reason.
      if (sameIds(element, s.selectedIds)) {
        return s;
      }
      return { selectedIds: element };
    });
  },

  enterMember: (id) => {
    const objects = get().project?.objects ?? [];
    if (objects.find((o) => o.id === id)?.groupId === undefined) {
      return;
    }
    set((s) =>
      s.selectedIds.length === 1 && s.selectedIds[0] === id
        ? s
        : { selectedIds: [id] },
    );
  },

  exitCollection: () => {
    const objects = get().project?.objects ?? [];
    set((s) => {
      if (enteredCollection(s.selectedIds, objects) === null) {
        return s;
      }
      return { selectedIds: expandToGroups(s.selectedIds, objects) };
    });
  },

  clearSelection: () => set({ selectedIds: [] }),

  setMultiSelectMode: (enabled, keepSelection = false) =>
    set((s) => {
      if (enabled) {
        return s.multiSelectMode ? s : { multiSelectMode: true };
      }
      // Collapsing keeps the single-object UI (handles, transform buttons)
      // meaningful. The seed is the *last* id — the element the user touched
      // most recently, which is where they expect the handles to land — and it
      // is expanded rather than taken alone, so leaving the mode never tears a
      // group in half. `keepSelection` (the Select button and the multi-select
      // toggle) exits the mode without collapsing at all.
      const seed = s.selectedIds[s.selectedIds.length - 1];
      const collapsed = seed
        ? expandToGroups([seed], s.project?.objects ?? [])
        : [];
      const selectedIds = keepSelection ? s.selectedIds : collapsed;
      if (!s.multiSelectMode && sameIds(selectedIds, s.selectedIds)) {
        return s;
      }
      return { multiSelectMode: false, selectedIds };
    }),

  setSizedObjects: (sizedObjects) =>
    set((s) => {
      const prev = s.sizedObjects;
      // The canvas rebuilds this list on every render; skip the write (and
      // the notification) when nothing that hit-testing reads has changed.
      if (
        prev.length === sizedObjects.length &&
        prev.every((o, i) => {
          const n = sizedObjects[i];
          return (
            o.id === n.id &&
            o.groupId === n.groupId &&
            o.transform === n.transform &&
            o.box.width === n.box.width &&
            o.box.height === n.box.height
          );
        })
      ) {
        return s;
      }
      return { sizedObjects };
    }),

  setViewport: (viewport) => {
    const v = get().viewport;
    if (
      v.scale === viewport.scale &&
      v.offsetX === viewport.offsetX &&
      v.offsetY === viewport.offsetY &&
      v.w === viewport.w &&
      v.h === viewport.h
    ) {
      return;
    }
    set({ viewport });
  },

  setGs: (patch) => set((s) => ({ gs: { ...s.gs, ...patch } })),

  addObject: (obj) => {
    get().snapshot();
    set((s) => ({
      project: { ...s.project!, objects: [...s.project!.objects, obj] },
      selectedIds: [obj.id],
    }));
  },

  updateObject: (id, patch) => {
    set((s) => {
      const objects = s.project!.objects.map((o) =>
        o.id === id
          ? ({
              ...o,
              ...patch,
              transform: patch.transform
                ? { ...o.transform, ...patch.transform }
                : o.transform,
            } as DesignObject)
          : o,
      );
      return { project: { ...s.project!, objects } };
    });
  },

  updateObjects: (patches) => {
    set((s) => {
      const byId = new Map(patches.map((p) => [p.id, p.patch]));
      let changed = false;
      const objects = s.project!.objects.map((o) => {
        const patch = byId.get(o.id);
        if (!patch) {
          return o;
        }
        changed = true;
        return {
          ...o,
          ...patch,
          transform: patch.transform
            ? { ...o.transform, ...patch.transform }
            : o.transform,
        } as DesignObject;
      });
      return changed ? { project: { ...s.project!, objects } } : s;
    });
  },

  removeObjects: (ids) => {
    const s0 = get();
    if (!s0.project || ids.length === 0) {
      return;
    }
    s0.snapshot();
    set((s) => {
      const objects = [
        ...dissolveSingletonGroups(
          s.project!.objects.filter((o) => !ids.includes(o.id)),
        ),
      ];
      return {
        project: { ...s.project!, objects },
        // Deleting a member of a group deletes the group (the selection is
        // always whole groups), so what is left is re-expanded against the
        // surviving document — which is also what drops the last trace of a
        // group that has just fallen below two members.
        selectedIds: expandToGroups(
          s.selectedIds.filter((x) => !ids.includes(x)),
          objects,
        ),
      };
    });
  },

  duplicateObjects: (ids) => {
    const s0 = get();
    if (!s0.project || ids.length === 0) {
      return;
    }
    const maxZ = Math.max(...s0.project.objects.map((o) => o.zIndex), 0);
    const clones = remapGroupIds(
      s0.project.objects
        .filter((o) => ids.includes(o.id))
        .map(
          (o, i) =>
            ({
              ...clone([o])[0],
              id: `${o.type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              transform: {
                ...o.transform,
                x: o.transform.x + 24,
                y: o.transform.y + 24,
              },
              zIndex: maxZ + 10 + i * 10,
              // A duplicate is a standalone object: it must not claim membership
              // of the source's split group, or the group would gain a second
              // part with the same index and could never be re-joined.
              part: undefined,
            }) as DesignObject,
        ),
      // A copied group becomes its own group. Sharing the source's id would
      // make the copy and the original one group, so dragging either would drag
      // both — and a copy of a single member dissolves back to standalone.
      newGroupId(),
    );
    s0.snapshot();
    set((s) => {
      const objects = [...s.project!.objects, ...clones];
      return {
        project: { ...s.project!, objects },
        // Whole elements again: the copy of a group comes back selected as one.
        selectedIds: expandToGroups(
          clones.map((c) => c.id),
          objects,
        ),
      };
    });
  },

  splitObjectIntoParts: (sourceId, parts) => {
    const s0 = get();
    if (!s0.project || parts.length === 0) {
      return;
    }
    const objects = s0.project.objects;
    const at = objects.findIndex((o) => o.id === sourceId);
    if (at < 0) {
      return;
    }
    const source = objects[at];
    // The parts take over the source's slot in the array. They all keep its
    // z-index, so array order (which a stable sort preserves) is their paint
    // order — the word still reads left-to-right in the same place.
    //
    // They also become a collection of their own: a split word is one element the
    // user can move, scale and rotate whole, and step back into letter by letter.
    // A word that was already grouped keeps its collection, so splitting a member
    // of a group never tears the group apart.
    const groupId = source.groupId ?? newGroupId();
    const stamped = parts.map((p) => ({ ...p, groupId }));
    const next = [
      ...dissolveSingletonGroups([
        ...objects.slice(0, at),
        ...stamped,
        ...objects.slice(at + 1),
      ]),
    ];
    s0.snapshot();
    set((s) => ({
      project: s.project ? { ...s.project, objects: next } : s.project,
      // Entered on the first letter, not on the whole collection: splitting still
      // drops the user straight into editing letter by letter, which is the whole
      // point of the operation.
      selectedIds: [stamped[0].id],
    }));
  },

  mergeObjectParts: (merged, partIds) => {
    const s0 = get();
    if (!s0.project || partIds.length === 0) {
      return;
    }
    const objects = s0.project.objects;
    const at = objects.findIndex((o) => partIds.includes(o.id));
    if (at < 0) {
      return;
    }
    const kept = objects.filter((o) => !partIds.includes(o.id));
    const insertAt = Math.min(at, kept.length);
    // The merged object inherits the membership its parts shared, so rejoining
    // a word inside a group leaves the group intact.
    const source = objects[at];
    const next = [
      ...dissolveSingletonGroups([
        ...kept.slice(0, insertAt),
        source.groupId === undefined
          ? merged
          : { ...merged, groupId: source.groupId },
        ...kept.slice(insertAt),
      ]),
    ];
    s0.snapshot();
    set((s) => ({
      project: s.project ? { ...s.project, objects: next } : s.project,
      selectedIds: expandToGroups([merged.id], next),
    }));
  },

  bringToFront: (ids) => {
    const s0 = get();
    if (!s0.project || ids.length === 0) {
      return;
    }
    const maxZ = Math.max(...s0.project.objects.map((o) => o.zIndex), 0);
    s0.snapshot();
    set((s) => ({
      project: {
        ...s.project!,
        objects: s.project!.objects.map((o) =>
          ids.includes(o.id)
            ? ({ ...o, zIndex: maxZ + 10 } as DesignObject)
            : o,
        ),
      },
    }));
  },

  sendToBack: (ids) => {
    const s0 = get();
    if (!s0.project || ids.length === 0) {
      return;
    }
    const minZ = Math.min(...s0.project.objects.map((o) => o.zIndex), 0);
    s0.snapshot();
    set((s) => ({
      project: {
        ...s.project!,
        objects: s.project!.objects.map((o) =>
          ids.includes(o.id)
            ? ({ ...o, zIndex: minZ - 10 } as DesignObject)
            : o,
        ),
      },
    }));
  },

  groupSelected: () => {
    const s0 = get();
    const objects = s0.project?.objects;
    // `canGroup` is the same predicate the rail asks for availability, so the
    // button and the behaviour can never disagree.
    if (!objects || !canGroup(s0.selectedIds, objects)) {
      return;
    }
    const groupId = newGroupId();
    const ids = new Set(s0.selectedIds);
    s0.snapshot();
    set((s) => ({
      project: {
        ...s.project!,
        objects: s.project!.objects.map((o) =>
          ids.has(o.id) ? ({ ...o, groupId } as DesignObject) : o,
        ),
      },
      // The selection is one element now, so the multi-select idiom (a tap adds
      // or toggles) would fight it: the next tap on the group would deselect it
      // instead of doing nothing. Same rule as the Select button — leave the
      // mode, keep what is selected.
      multiSelectMode: false,
    }));
  },

  ungroupSelected: () => {
    const s0 = get();
    const objects = s0.project?.objects;
    if (!objects || !canUngroup(s0.selectedIds, objects)) {
      return;
    }
    const ids = new Set(s0.selectedIds);
    s0.snapshot();
    set((s) => ({
      project: {
        ...s.project!,
        objects: s.project!.objects.map((o) =>
          ids.has(o.id) ? ({ ...o, groupId: undefined } as DesignObject) : o,
        ),
      },
      // The result *is* a multi-selection, so the mode has to come on — exactly
      // the reason `selectAll` switches it on: the count badge and the align
      // actions are about to appear, and with the mode off the very next tap
      // would replace the whole selection instead of adding to it.
      multiSelectMode: true,
    }));
  },

  alignSelected: (mode) => {
    const s0 = get();
    const canvas = s0.project?.canvas;
    if (!canvas) {
      return;
    }
    // Align works on *elements*, not objects: a group is one unit that moves as
    // a whole, so aligning a group cannot collapse it onto its own outermost
    // member. A loose object is a one-object unit, which is why a plain
    // multi-selection aligns exactly as it always has.
    const units = selectionUnits(s0.selectedIds, s0.project!.objects)
      .map((ids) =>
        ids
          .map((id) => s0.sizedObjects.find((o) => o.id === id))
          .filter((o): o is SizedObject => o !== undefined),
      )
      .filter((unit) => unit.length > 0);
    if (units.length === 0) {
      return;
    }
    const updates = computeAlignUpdates(mode, units, canvas);
    const targets = new Map(updates.map((u) => [u.id, u.transform]));
    if (targets.size === 0) {
      return;
    }
    // Nothing to do when every object is already on target — keeps the undo
    // stack free of no-op entries.
    const changed = s0.project!.objects.some((o) => {
      const t = targets.get(o.id);
      if (!t) {
        return false;
      }
      return (
        Math.abs(o.transform.x - t.x) > 0.001 ||
        Math.abs(o.transform.y - t.y) > 0.001
      );
    });
    if (!changed) {
      return;
    }
    // One snapshot and one set() for the whole group, so a single undo reverts
    // the entire alignment.
    s0.snapshot();
    set((s) => ({
      project: s.project
        ? {
            ...s.project,
            objects: s.project.objects.map((o) => {
              const t = targets.get(o.id);
              return t
                ? ({
                    ...o,
                    transform: { ...o.transform, ...t },
                  } as DesignObject)
                : o;
            }),
          }
        : s.project,
    }));
  },

  nudgeSelected: (dx, dy) => {
    const s0 = get();
    if (!s0.project || s0.selectedIds.length === 0 || (dx === 0 && dy === 0)) {
      return;
    }
    // A held arrow key auto-repeats at roughly 30 presses per second, so a
    // burst of nudges shares one snapshot rather than flushing the 50-entry
    // history. The burst also closes the moment anything else is recorded.
    const now = Date.now();
    const continuesBurst =
      now - s0.gs.nudgeBurstAt <= NUDGE_COALESCE_MS &&
      s0.gs.nudgeBurstAnchor === (s0.past[s0.past.length - 1]?.objects ?? null);
    if (!continuesBurst) {
      s0.snapshot();
    }
    set((s) => ({
      gs: {
        ...s.gs,
        nudgeBurstAt: now,
        nudgeBurstAnchor: s.past[s.past.length - 1]?.objects ?? null,
      },
      // One set() for the whole move, so a single undo reverts all of it.
      project: s.project
        ? {
            ...s.project,
            objects: s.project.objects.map((o) =>
              s.selectedIds.includes(o.id)
                ? ({
                    ...o,
                    transform: {
                      ...o.transform,
                      x: o.transform.x + dx,
                      y: o.transform.y + dy,
                    },
                  } as DesignObject)
                : o,
            ),
          }
        : s.project,
    }));
  },

  selectAll: () => {
    const s0 = get();
    if (!s0.project || s0.project.objects.length === 0) {
      return;
    }
    // Select-all *is* a multi-selection, so it has to switch the mode on:
    // otherwise the count badge and the align actions appear while the very
    // next tap replaces the whole selection instead of adding to it.
    set({
      selectedIds: s0.project.objects.map((o) => o.id),
      multiSelectMode: true,
    });
  },

  snapshot: () => {
    set((s) => {
      const current = s.project?.objects ?? [];
      const last = s.past[s.past.length - 1];
      // Avoid pushing an identical snapshot for no-op snapshots. Comparing the
      // objects alone is what makes this safe: an identical entry already *is*
      // the pre-mutation state, so skipping it costs the undo nothing.
      if (last && JSON.stringify(last.objects) === JSON.stringify(current)) {
        return {};
      }
      return {
        past: [
          ...s.past,
          { objects: clone(current), selectedIds: [...s.selectedIds] },
        ].slice(-MAX_HISTORY),
        future: [],
      };
    });
  },

  undo: () => {
    set((s) => {
      const prev = s.past[s.past.length - 1];
      if (!prev) {
        return {};
      }
      const current = s.project!.objects;
      return {
        past: s.past.slice(0, -1),
        future: [
          ...s.future,
          { objects: clone(current), selectedIds: [...s.selectedIds] },
        ].slice(-MAX_HISTORY),
        project: { ...s.project!, objects: clone(prev.objects) },
        // The selection comes back with the objects, so an undone delete is
        // undone completely.
        selectedIds: restorableSelection(prev),
      };
    });
  },

  redo: () => {
    set((s) => {
      const next = s.future[s.future.length - 1];
      if (!next) {
        return {};
      }
      const current = s.project!.objects;
      return {
        future: s.future.slice(0, -1),
        past: [
          ...s.past,
          { objects: clone(current), selectedIds: [...s.selectedIds] },
        ].slice(-MAX_HISTORY),
        project: { ...s.project!, objects: clone(next.objects) },
        selectedIds: restorableSelection(next),
      };
    });
  },

  setCanvas: (patch) =>
    set((s) => ({
      project: s.project
        ? { ...s.project, canvas: { ...s.project.canvas, ...patch } }
        : s.project,
    })),

  setGrid: (gridEnabled) =>
    set((s) => ({
      project: s.project ? { ...s.project, gridEnabled } : s.project,
    })),

  setProjectName: (name) =>
    set((s) => ({
      project: s.project ? { ...s.project, name } : s.project,
    })),
}));
