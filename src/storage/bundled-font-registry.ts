/**
 * Bundled display-face registration — the session's "loaded bundled set".
 *
 * The eager core loads with the app (`use-bootstrap.ts`); the forty-one lazy
 * faces in `displayFontAssets` load here, on demand. This module
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

/**
 * Faces with a `loadAsync` in flight, sharing the promise of the batch that is
 * loading them. A second caller naming one of these **awaits** it rather than
 * issuing a competing load — the cover gate depends on that, since it opens the
 * design on the strength of this promise resolving.
 */
const inFlight = new Map<string, Promise<void>>();

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

/**
 * Load the given display faces that are not loaded yet, then publish.
 *
 * Idempotent, and cheap to call freely: a key already in the snapshot is
 * skipped, a key outside `displayFontKeys` (a core face, a remote key, a
 * removed face) is ignored, and duplicates collapse — so opening a design that
 * names the same face three times loads it once.
 *
 * A face whose load rejects is left out of the snapshot, but the snapshot is
 * still published with the faces that did load — the picker's warm-up is one
 * batch of forty-one, so suppressing `publish` on a single failure would strand
 * every other row on its fallback. The `await` then throws, so the editor's
 * cover gate still refuses to open on a design whose face is missing, and the
 * next call retries the rejected key. The snapshot therefore mirrors what is
 * actually registered, never what was asked for.
 *
 * Concurrent callers are safe because there are three of them — the editor's
 * open path, the cover gate's ensure, and the picker's warm-up — and the last two
 * can name a face the first already has in flight. A key already loading is
 * **awaited**, not skipped: skipping it would resolve this call while the face
 * was still absent, and the cover gate awaits this promise before it lets the
 * design render.
 */
export async function ensureBundledFonts(
  keys: Iterable<string>,
): Promise<void> {
  const wanted = [...new Set(keys)].filter(
    (key) => displayFontKeys.has(key) && !loadedKeys.has(key),
  );
  const loading = wanted.filter((key) => inFlight.has(key));
  const missing = wanted.filter((key) => !inFlight.has(key));

  if (missing.length > 0) {
    // Load each face on its own and settle them all. The picker's warm-up asks
    // for all forty-one at once, and one unloadable face must not stop the
    // others from being published — `publish` is what repaints their rows, so a
    // single failure would otherwise leave every loaded face showing its
    // fallback.
    const batch = Promise.allSettled(
      missing.map((key) =>
        loadFontAsync({
          [key]: displayFontAssets[key as keyof typeof displayFontAssets],
        }).then(() => key),
      ),
    )
      .then((results) => {
        const fulfilled = results
          .filter(
            (result): result is PromiseFulfilledResult<string> =>
              result.status === 'fulfilled',
          )
          .map((result) => result.value);
        // Read `loadedKeys` now, not before the await: a sibling batch may have
        // published in the meantime and this must not drop its faces.
        publish(new Set([...loadedKeys, ...fulfilled]));
        // A requested face that failed still rejects the batch: the editor's
        // cover gate awaits this and must not open on a design whose face is
        // missing. Publishing above already repaired what did load.
        const rejection = results.find(
          (result): result is PromiseRejectedResult =>
            result.status === 'rejected',
        );
        if (rejection) {
          throw rejection.reason instanceof Error
            ? rejection.reason
            : new Error(String(rejection.reason));
        }
      })
      .finally(() => {
        for (const key of missing) {
          inFlight.delete(key);
        }
      });
    for (const key of missing) {
      inFlight.set(key, batch);
    }
    await batch;
  }
  if (loading.length > 0) {
    await Promise.all(loading.map((key) => inFlight.get(key)!));
  }
}

/**
 * Load every bundled display face — the font picker's background warm-up, so
 * tapping a family in the list is instant. Failure is not surfaced: a warm-up
 * that rejects leaves the snapshot short, and the editor's ensure (which runs
 * against whatever keys the document actually names) retries the one face that is
 * needed, standing the cover gate down if it cannot be had.
 */
export function warmDisplayFonts(): Promise<void> {
  return ensureBundledFonts(displayFontKeys);
}
