import { useCallback } from "react";

/**
 * Right-click / context-menu support for gallery rows.
 *
 * Platform-split (Metro resolves `.web.ts` on web) because the web
 * implementation touches `HTMLElement` and `document`, which must never be
 * evaluated in a native bundle. Native has no right-click at all — long-press
 * is the equivalent gesture and is already wired — so the ref is inert here.
 *
 * Returns a stable callback ref to attach to the row wrapper, mirroring the
 * repo's `EditorCanvasHost` / `EditorCanvasHost.web` split.
 */
export function useContextMenu(onOpen: () => void): (node: unknown) => void {
  const ref = useCallback(() => {
    // `void` keeps the shared call signature honest without pretending to use it.
    void onOpen;
  }, [onOpen]);
  return ref;
}
