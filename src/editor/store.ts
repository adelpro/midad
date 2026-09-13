import { create } from "zustand";

import { computeAlignUpdates, type AlignMode } from "@/editor/align";
import type { ResizeHandle, SizedObject } from "@/editor/hit-test";
import { NUDGE_COALESCE_MS } from "@/editor/shortcuts";
import type {
  CalligraphyTextObject,
  DesignObject,
  MidadProject,
} from "@/storage/project-schema";

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
}

/** An object's center as captured when a drag started. */
export interface DragOrigin {
  id: string;
  x: number;
  y: number;
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
  transformTargetId: string | null;
  scaleOrigin: number;
  rotationOrigin: number;
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
  transformTargetId: null,
  scaleOrigin: 1,
  rotationOrigin: 0,
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
  past: DesignObject[][];
  future: DesignObject[][];

  loadProject: (project: MidadProject) => void;
  select: (id: string | null, additive?: boolean) => void;
  clearSelection: () => void;
  setMultiSelectMode: (enabled: boolean) => void;
  setSizedObjects: (objects: SizedObject[]) => void;
  setViewport: (v: Viewport) => void;
  setGs: (patch: Partial<GestureScratch>) => void;

  addObject: (obj: DesignObject) => void;
  updateObject: (id: string, patch: Partial<DesignObject>) => void;
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

  setCanvas: (patch: Partial<MidadProject["canvas"]>) => void;
  setGrid: (enabled: boolean) => void;
  setName: (name: string) => void;
}

const MAX_HISTORY = 50;

function clone(objects: DesignObject[]): DesignObject[] {
  return objects.map((o) => ({ ...o, transform: { ...o.transform } }));
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  selectedIds: [],
  multiSelectMode: false,
  sizedObjects: [],
  viewport: { scale: 1, offsetX: 0, offsetY: 0 },
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
    if (id == null) {
      set({ selectedIds: [] });
      return;
    }
    set((s) => {
      if (additive) {
        return {
          selectedIds: s.selectedIds.includes(id)
            ? s.selectedIds.filter((x) => x !== id)
            : [...s.selectedIds, id],
        };
      }
      return { selectedIds: [id] };
    });
  },

  clearSelection: () => set({ selectedIds: [] }),

  setMultiSelectMode: (enabled) =>
    set((s) => ({
      multiSelectMode: enabled,
      // Collapsing to a single id when the mode is switched off keeps the
      // single-object UI (handles, transform buttons) meaningful.
      selectedIds: enabled ? s.selectedIds : s.selectedIds.slice(0, 1),
    })),

  setSizedObjects: (sizedObjects) => set({ sizedObjects }),

  setViewport: (viewport) => {
    const v = get().viewport;
    if (
      v.scale === viewport.scale &&
      v.offsetX === viewport.offsetX &&
      v.offsetY === viewport.offsetY
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

  removeObjects: (ids) => {
    get().snapshot();
    set((s) => ({
      project: {
        ...s.project!,
        objects: s.project!.objects.filter((o) => !ids.includes(o.id)),
      },
      selectedIds: s.selectedIds.filter((x) => !ids.includes(x)),
    }));
  },

  duplicateObjects: (ids) => {
    const s0 = get();
    if (!s0.project || ids.length === 0) {
      return;
    }
    const maxZ = Math.max(...s0.project.objects.map((o) => o.zIndex), 0);
    const clones = s0.project.objects
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
      );
    s0.snapshot();
    set((s) => ({
      project: { ...s.project!, objects: [...s.project!.objects, ...clones] },
      selectedIds: clones.map((c) => c.id),
    }));
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
    // The parts take over the source's slot in the array. They all keep its
    // z-index, so array order (which a stable sort preserves) is their paint
    // order — the word still reads left-to-right in the same place.
    const next = [...objects.slice(0, at), ...parts, ...objects.slice(at + 1)];
    s0.snapshot();
    set((s) => ({
      project: s.project ? { ...s.project, objects: next } : s.project,
      selectedIds: [parts[0].id],
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
    const next = [...kept.slice(0, insertAt), merged, ...kept.slice(insertAt)];
    s0.snapshot();
    set((s) => ({
      project: s.project ? { ...s.project, objects: next } : s.project,
      selectedIds: [merged.id],
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

  alignSelected: (mode) => {
    const s0 = get();
    const canvas = s0.project?.canvas;
    if (!canvas) {
      return;
    }
    const selected = s0.sizedObjects.filter((o) =>
      s0.selectedIds.includes(o.id),
    );
    if (selected.length === 0) {
      return;
    }
    const updates = computeAlignUpdates(mode, selected, canvas);
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
      s0.gs.nudgeBurstAnchor === (s0.past[s0.past.length - 1] ?? null);
    if (!continuesBurst) {
      s0.snapshot();
    }
    set((s) => ({
      gs: {
        ...s.gs,
        nudgeBurstAt: now,
        nudgeBurstAnchor: s.past[s.past.length - 1] ?? null,
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
    set({ selectedIds: s0.project.objects.map((o) => o.id) });
  },

  snapshot: () => {
    set((s) => {
      const current = s.project?.objects ?? [];
      const last = s.past[s.past.length - 1];
      // Avoid pushing an identical snapshot for no-op snapshots.
      if (last && JSON.stringify(last) === JSON.stringify(current)) {
        return {};
      }
      return {
        past: [...s.past, clone(current)].slice(-MAX_HISTORY),
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
        future: [...s.future, clone(current)].slice(-MAX_HISTORY),
        project: { ...s.project!, objects: clone(prev) },
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
        past: [...s.past, clone(current)].slice(-MAX_HISTORY),
        project: { ...s.project!, objects: clone(next) },
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

  setName: (name) =>
    set((s) => ({ project: s.project ? { ...s.project, name } : s.project })),
}));
