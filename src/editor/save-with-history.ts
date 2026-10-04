/**
 * The history-aware save.
 *
 * `saveProject` sweeps stored asset bytes whose object is no longer in the
 * document. That is right for a deleted object and **wrong for an undoable one**:
 * a delete is a document state the user can step back from, and the autosave
 * debounce is one second, so the sweep runs before anyone reaches for undo.
 *
 * Every save therefore carries the ids its history can still restore. This module
 * derives them from the store and calls `saveProject`, so no call site has to
 * remember to — and a new call site that uses it is safe by default.
 *
 * The buffer is the whole past *and* future stack, not just the newest entry: the
 * user can undo several steps, redo forward again, and reach any of them.
 */

import { useEditorStore } from '@/editor/store';
import { saveProject } from '@/storage/projects';

/** Every object id any reachable history step still references. */
export function retainableObjectIds(): string[] {
  const { past, future } = useEditorStore.getState();
  return [
    ...new Set(
      [...past, ...future].flatMap((entry) =>
        entry.objects.map((object) => object.id),
      ),
    ),
  ];
}

/**
 * Save the current document, retaining the bytes of anything the history can
 * bring back. Returns the promise so a caller that needs the write to have landed
 * can await it; a caller that does not can `void` it.
 */
export function saveWithHistory(): Promise<void> {
  const live = useEditorStore.getState().project;
  if (!live) {
    return Promise.resolve();
  }
  return saveProject(
    { ...live, updatedAt: new Date().toISOString() },
    { retainObjectIds: retainableObjectIds() },
  );
}
