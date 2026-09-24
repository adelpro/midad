import { useSyncExternalStore } from 'react';

import {
  getInstalledRemoteFontKeys,
  subscribeInstalledRemoteFonts,
} from '@/storage/remote-font-registry';

/**
 * The set of remote fontKeys registered this session. Re-renders whenever a
 * face is downloaded (or purged), so the picker's weight chips and the
 * missing-font banner stay live without polling: `getInstalledRemoteFontKeys`
 * returns a stable snapshot that the registry only replaces on content change.
 */
export function useInstalledRemoteFontKeys(): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribeInstalledRemoteFonts,
    getInstalledRemoteFontKeys,
    getInstalledRemoteFontKeys,
  );
}
