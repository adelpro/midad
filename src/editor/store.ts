import { create } from 'zustand';

import type { DesignObject, MidadProject } from '@/storage/project-schema';
import type { SizedObject } from '@/editor/hit-test';

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

/**
 * Non-reactive gesture-interaction scratch state. Lives in the store (not
 * refs) so gesture handlers stay React-Compiler-safe; nothing subscribes to
 * this slice, so mutations never trigger renders.
 */
interface GestureScratch {
  dragId: string | null;
  dragOriginX: number;
  dragOriginY: number;
  transformTargetId: string | null;
  scaleOrigin: number;
  rotationOrigin: number;
}

const EMPTY_SCRATCH: GestureScratch = {
  dragId: null,
  dragOriginX: 0,
  dragOriginY: 0,
  transformTargetId: null,
  scaleOrigin: 1,
  rotationOrigin: 0,
};

interface EditorState {
  project: MidadProject | null;
  selectedIds: string[];
  sizedObjects: SizedObject[];
  viewport: Viewport;
  gs: GestureScratch;
  past: DesignObject[][];
  future: DesignObject[][];

  loadProject: (project: MidadProject) => void;
  select: (id: string | null, additive?: boolean) => void;
  clearSelection: () => void;
  setSizedObjects: (objects: SizedObject[]) => void;
  setViewport: (v: Viewport) => void;
  setGs: (patch: Partial<GestureScratch>) => void;

  addObject: (obj: DesignObject) => void;
  updateObject: (id: string, patch: Partial<DesignObject>) => void;
  removeObjects: (ids: string[]) => void;
  duplicateObjects: (ids: string[]) => void;
  bringToFront: (ids: string[]) => void;
  sendToBack: (ids: string[]) => void;
  /** Push the current objects onto history before a mutation. */
  snapshot: () => void;
  undo: () => void;
  redo: () => void;

  setCanvas: (patch: Partial<MidadProject['canvas']>) => void;
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
  sizedObjects: [],
  viewport: { scale: 1, offsetX: 0, offsetY: 0 },
  gs: EMPTY_SCRATCH,
  past: [],
  future: [],

  loadProject: (project) =>
    set({
      project,
      selectedIds: [],
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
        return { selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id] };
      }
      return { selectedIds: [id] };
    });
  },

  clearSelection: () => set({ selectedIds: [] }),

  setSizedObjects: (sizedObjects) => set({ sizedObjects }),

  setViewport: (viewport) => {
    const v = get().viewport;
    if (v.scale === viewport.scale && v.offsetX === viewport.offsetX && v.offsetY === viewport.offsetY) {
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
      const objects = s.project!.objects.map((o) => (o.id === id ? ({ ...o, ...patch, transform: patch.transform ? { ...o.transform, ...patch.transform } : o.transform } as DesignObject) : o));
      return { project: { ...s.project!, objects } };
    });
  },

  removeObjects: (ids) => {
    get().snapshot();
    set((s) => ({
      project: { ...s.project!, objects: s.project!.objects.filter((o) => !ids.includes(o.id)) },
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
      .map((o, i) => ({
        ...clone([o])[0],
        id: `${o.type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        transform: { ...o.transform, x: o.transform.x + 24, y: o.transform.y + 24 },
        zIndex: maxZ + 10 + i * 10,
      }) as DesignObject);
    s0.snapshot();
    set((s) => ({
      project: { ...s.project!, objects: [...s.project!.objects, ...clones] },
      selectedIds: clones.map((c) => c.id),
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
          ids.includes(o.id) ? ({ ...o, zIndex: maxZ + 10 } as DesignObject) : o,
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
          ids.includes(o.id) ? ({ ...o, zIndex: minZ - 10 } as DesignObject) : o,
        ),
      },
    }));
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

  setCanvas: (patch) => set((s) => ({ project: s.project ? { ...s.project, canvas: { ...s.project.canvas, ...patch } } : s.project })),

  setGrid: (gridEnabled) => set((s) => ({ project: s.project ? { ...s.project, gridEnabled } : s.project })),

  setName: (name) => set((s) => ({ project: s.project ? { ...s.project, name } : s.project })),
}));