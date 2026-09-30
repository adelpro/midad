/**
 * Bundled display-face registration — the session's "loaded bundled set".
 *
 * The eager core loads with the app (`use-bootstrap.ts`); the twenty-nine
 * calligraphic faces in `displayFontAssets` load here, on demand. This module
 * is the only place that loads them, and it mirrors `remote-font-registry.ts`:
 * the snapshot is what expo-font actually holds, it is replaced only when its
 * content changes, and `useLoadedBundledFontKeys` re-renders its consumers
 * without polling.
 *
 * The remote registry is a separate door for a separate set of faces: a
 * `remote:` key never comes through here, because `displayFontKeys` does not
 * contain one.
 */
import { loadAsync as loadFontAsync } from 'expo-font';

import { displayFontAssets, displayFontKeys } from '@/theme';

type Listener = () => void;

/** The display faces expo-font currently holds, keyed by their asset key. */
let loadedKeys: ReadonlySet<string> = new Set();
const listeners = new Set<Listener>();

/** Replace the snapshot, notifying only when its content actually changed. */
function publish(next: ReadonlySet<string>): void {
  const changed =
    next.size !== loadedKeys.size ||
    [...next].some((key) => !loadedKeys.has(key));
  if (!changed) {
    return;
  }
  loadedKeys = next;
  for (const listener of [...listeners]) {
    listener();
  }
}

/** Synchronous loaded-face snapshot, for the `useSyncExternalStore` hook. */
export function getLoadedBundledFontKeys(): ReadonlySet<string> {
  return loadedKeys;
}

export function subscribeLoadedBundledFonts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isBundledFontLoaded(key: string): boolean {
  return loadedKeys.has(key);
}

/**
 * Load the given display faces that are not loaded yet, then publish.
 *
 * Idempotent, and cheap to call freely: a key already in the snapshot is
 * skipped, a key outside `displayFontKeys` (a core face, a remote key, a
 * removed face) is ignored, and duplicates collapse — so opening a design that
 * names the same face three times loads it once.
 *
 * A face whose load rejects is left out of the snapshot: the `await` throws
 * before `publish` runs, which is the same rule the remote registry follows —
 * the snapshot mirrors what is actually registered, never what was asked for.
 * The next call retries it.
 */
export async function ensureBundledFonts(
  keys: Iterable<string>,
): Promise<void> {
  const missing = [...new Set(keys)].filter(
    (key) => displayFontKeys.has(key) && !loadedKeys.has(key),
  );
  if (missing.length === 0) {
    return;
  }
  await loadFontAsync(
    Object.fromEntries(
      missing.map((key) => [
        key,
        displayFontAssets[key as keyof typeof displayFontAssets],
      ]),
    ),
  );
  publish(new Set([...loadedKeys, ...missing]));
}

/**
 * Load every bundled display face — the font picker's background warm-up, so
 * tapping a family in the list is instant. Failure is not surfaced: a warm-up
 * that rejects leaves the snapshot short, and the picker's own `ensure` call
 * on selection retries the one face that is actually needed.
 */
export function warmDisplayFonts(): Promise<void> {
  return ensureBundledFonts(displayFontKeys);
}
