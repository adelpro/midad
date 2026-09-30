import { useSyncExternalStore } from 'react';

import {
  getLoadedBundledFontKeys,
  subscribeLoadedBundledFonts,
} from '@/storage/bundled-font-registry';

/**
 * The set of bundled display faces loaded this session. Re-renders whenever a
 * display face finishes loading (for example, after ensuring the faces a design
 * needs, or during the picker's background warm-up). The snapshot is stable
 * between content changes — only when it actually changes does this hook
 * notify.
 *
 * The first screen never consumes this set (it only draws core faces). Callers
 * that need the full face set for the paragraph provider combine this with the
 * installed remote snapshot.
 */
export function useLoadedBundledFontKeys(): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribeLoadedBundledFonts,
    getLoadedBundledFontKeys,
    getLoadedBundledFontKeys,
  );
}
