import { useEffect, useSyncExternalStore } from 'react';

import {
  getInstalledRemoteFontKeys,
  refreshInstalledRemoteFonts,
  subscribeInstalledRemoteFonts,
} from '@/storage/remote-font-registry';

/**
 * The set of remote fontKeys registered this session. Re-renders whenever a
 * face is downloaded (or purged), so the picker's weight chips and the
 * missing-font banner stay live without polling: `getInstalledRemoteFontKeys`
 * returns a stable snapshot that the registry only replaces on content change.
 *
 * The first consumer in a freshly launched session warms the snapshot from the
 * cache index (`refreshInstalledRemoteFonts`) in a mount effect — this is a
 * sync-with-external-store side effect, not a render-time one — so faces
 * installed in a previous launch already show as installed: the picker's chips
 * are correct from their first frame instead of flipping a beat later. The
 * reconcile publishes only on content change, so a warm-up that finds nothing
 * new notifies nobody.
 */
export function useInstalledRemoteFontKeys(): ReadonlySet<string> {
  const keys = useSyncExternalStore(
    subscribeInstalledRemoteFonts,
    getInstalledRemoteFontKeys,
    getInstalledRemoteFontKeys,
  );
  useEffect(() => {
    void refreshInstalledRemoteFonts();
  }, []);
  return keys;
}
