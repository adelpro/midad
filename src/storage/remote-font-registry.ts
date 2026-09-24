/**
 * Remote font registration — the single owner of the installed-face snapshot
 * and of registering downloaded faces with expo-font.
 *
 * A face enters the app through exactly one door: `downloadRemoteFont` (a
 * picker weight chip, or the missing-font banner), which installs it into the
 * cache and then reconciles it here. Reconciliation does two things, and this
 * module is the only place either happens, so the two registrations can never
 * drift apart:
 *
 * 1. `Font.loadAsync` — makes the face renderable by RN `<Text>`/`TextInput`
 *    (the TextPreview, the FontField specimen) under its `fontKey` family
 *    name;
 * 2. publishes the installed snapshot — `useInstalledRemoteFontKeys` re-renders
 *    the picker rows, and `useParagraphFonts` (`src/editor/skia/text.ts`)
 *    rebuilds its typeface provider from the very same snapshot, so the canvas
 *    renders the face too.
 *
 * The snapshot mirrors what expo-font actually holds, not the cache index: a
 * face whose file was purged by the OS (native cache is OS-purgeable) is
 * re-scanned out on the next refresh, and a face that fails to register is left
 * out so the UI can offer a retry instead of pretending it is installed.
 */
import { loadAsync as loadFontAsync } from 'expo-font';

import {
  installRemoteFont,
  isRemoteFontInstalled,
  listInstalledRemoteFonts,
  uriForRemoteFont,
  type RemoteFontCacheEntry,
} from '@/storage/remote-font-cache';
import { isRemoteFontKey } from '@/theme/remote-fonts';

type Listener = () => void;

/** The faces expo-font currently holds, keyed by their `fontKey`. */
let installedKeys: ReadonlySet<string> = new Set();
const listeners = new Set<Listener>();

/** Replace the snapshot, notifying only when its content actually changed. */
function publish(next: readonly string[]): void {
  const changed =
    next.length !== installedKeys.size ||
    next.some((key) => !installedKeys.has(key));
  if (!changed) {
    return;
  }
  installedKeys = new Set(next);
  for (const listener of [...listeners]) {
    listener();
  }
}

/** Synchronous installed-face snapshot, for the `useSyncExternalStore` hook. */
export function getInstalledRemoteFontKeys(): ReadonlySet<string> {
  return installedKeys;
}

export function subscribeInstalledRemoteFonts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Scan the cache and reconcile expo-font with it: register faces that are on
 * disk but not yet loaded, drop faces whose files were purged (native), and
 * publish the resulting snapshot. Idempotent — call freely after any install;
 * a snapshot whose content is unchanged notifies nobody.
 */
export async function refreshInstalledRemoteFonts(): Promise<void> {
  const fontKeys = await listInstalledRemoteFonts();
  const registered = await Promise.all(
    fontKeys.map(async (fontKey): Promise<string | null> => {
      const uri = await uriForRemoteFont(fontKey);
      if (!uri) {
        return null;
      }
      try {
        await loadFontAsync({ [fontKey]: uri });
        return fontKey;
      } catch {
        // A face that fails to register is left out of the snapshot; the UI
        // shows it as missing and the user can re-download it.
        return null;
      }
    }),
  );
  publish(registered.filter((key): key is string => key !== null));
}

/**
 * Download a face and make it live: install into the cache, register with
 * expo-font, publish the snapshot. Idempotent — a repeat call re-uses the
 * cached bytes and re-registers (which expo-font skips for loaded faces).
 */
export async function downloadRemoteFont(
  id: string,
  weight: number,
  subset = 'arabic',
): Promise<RemoteFontCacheEntry> {
  const entry = await installRemoteFont(id, weight, subset);
  await refreshInstalledRemoteFonts();
  return entry;
}

/**
 * The remote fontKeys a design needs that are not installed on this device, in
 * first-use order. Bundled and unknown keys are ignored. This drives the
 * missing-font banner on document open — the never-silent half of the
 * contract: a face that is not here is named and offered for download, never
 * silently substituted.
 */
export async function missingRemoteFontKeys(
  fontKeys: readonly string[],
): Promise<string[]> {
  const seen = new Set<string>();
  const missing: string[] = [];
  for (const fontKey of fontKeys) {
    if (!isRemoteFontKey(fontKey) || seen.has(fontKey)) {
      continue;
    }
    seen.add(fontKey);
    if (!(await isRemoteFontInstalled(fontKey))) {
      missing.push(fontKey);
    }
  }
  return missing;
}
