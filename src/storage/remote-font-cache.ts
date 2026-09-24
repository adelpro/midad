/**
 * Remote font cache — download a Google Font face on demand and keep the
 * device's copy in a small AsyncStorage index.
 *
 * Mirrors `thumbs.ts`: native stores the TTF bytes in `Paths.cache`
 * (expo-file-system, dynamic import) and the web build keeps no bytes — it
 * re-resolves the CORS-open CDN URL and warms the browser HTTP cache on
 * install. Native cache files are OS-purgeable, so callers must treat a
 * missing file as `remote-missing` and re-download on use (Phase 2/3); this
 * module exposes the primitives.
 *
 * Storage budget: face files are small per-subset TTFs (roughly 40–150KB for
 * arabic); the Android AsyncStorage default is 6MB total, which is why the web
 * build stores URLs, not bytes.
 */
import { Platform } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  parseRemoteFontKey,
  remoteFontKey,
  remoteFontTtfUrl,
} from '@/theme/remote-fonts';

/** A downloaded face, as recorded in the cache index. */
export interface RemoteFontCacheEntry {
  fontKey: string;
  /** Fontsource slug, e.g. `'markazi-text'`. */
  id: string;
  /** CSS weight, e.g. 400. */
  weight: number;
  /** Subsets that were downloaded (v1: `['arabic']`). */
  subsets: readonly string[];
  /** Native: `file://…` in `Paths.cache`. Web: the CDN URL. */
  uri: string;
  /** Where `uri` points — native caches bytes, web re-resolves the URL. */
  source: 'file' | 'url';
  downloadedAt: number;
}

const INDEX_KEY = 'midad:remote-fonts:v1';

function fileName(fontKey: string): string {
  const parsed = parseRemoteFontKey(fontKey);
  return parsed
    ? `${parsed.id}-${parsed.weight}.ttf`
    : `${fontKey.replace(/[^a-z0-9-]/gi, '-')}.ttf`;
}

type Index = Record<string, RemoteFontCacheEntry>;

async function readIndex(): Promise<Index> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as Index) : {};
  } catch {
    return {};
  }
}

async function writeIndex(index: Index): Promise<void> {
  try {
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // Best-effort: a full index is a few KB; a failed write means the face is
    // simply re-downloaded next time.
  }
}

export async function isRemoteFontInstalled(fontKey: string): Promise<boolean> {
  const entry = (await readIndex())[fontKey];
  if (!entry) {
    return false;
  }
  if (entry.source === 'file') {
    const { File } = await import('expo-file-system');
    return new File(entry.uri).exists;
  }
  return true; // web faces are URLs — resolvable whenever the network is
}

/** Download a face (id + weight) and record it in the index. Idempotent. */
export async function installRemoteFont(
  id: string,
  weight: number,
  subset = 'arabic',
): Promise<RemoteFontCacheEntry> {
  const fontKey = remoteFontKey(id, weight);
  if (await isRemoteFontInstalled(fontKey)) {
    const existing = (await readIndex())[fontKey];
    if (existing) {
      return existing;
    }
  }

  const url = remoteFontTtfUrl(id, weight, subset);
  const bytes = await fetchFontBytes(url);

  let entry: RemoteFontCacheEntry;
  if (Platform.OS === 'web') {
    // Keep no bytes (AsyncStorage budget); the browser HTTP cache warms here.
    entry = {
      fontKey,
      id,
      weight,
      subsets: [subset],
      uri: url,
      source: 'url',
      downloadedAt: Date.now(),
    };
  } else {
    const { File, Paths } = await import('expo-file-system');
    const file = new File(Paths.cache, fileName(fontKey));
    if (file.exists) {
      file.delete();
    }
    file.create();
    file.write(bytes);
    entry = {
      fontKey,
      id,
      weight,
      subsets: [subset],
      uri: file.uri,
      source: 'file',
      downloadedAt: Date.now(),
    };
  }

  const index = await readIndex();
  index[fontKey] = entry;
  await writeIndex(index);
  return entry;
}

/** The local URI (native) or CDN URL (web) a face can be loaded from, or null. */
export async function uriForRemoteFont(
  fontKey: string,
): Promise<string | null> {
  const entry = (await readIndex())[fontKey];
  if (!entry) {
    return null;
  }
  if (entry.source === 'file') {
    const { File } = await import('expo-file-system');
    if (!new File(entry.uri).exists) {
      return null;
    }
  }
  return entry.uri;
}

/** The raw TTF bytes of an installed face, or null when missing. */
export async function bytesForRemoteFont(
  fontKey: string,
): Promise<Uint8Array | null> {
  const uri = await uriForRemoteFont(fontKey);
  if (!uri) {
    return null;
  }
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    if (!res.ok) {
      return null;
    }
    return new Uint8Array(await res.arrayBuffer());
  }
  const { File } = await import('expo-file-system');
  return new File(uri).bytes();
}

/** The fontKeys of every face installed on this device. */
export async function listInstalledRemoteFonts(): Promise<string[]> {
  const index = await readIndex();
  const keys: string[] = [];
  for (const [fontKey, entry] of Object.entries(index)) {
    if (entry.source === 'file') {
      const { File } = await import('expo-file-system');
      if (!new File(entry.uri).exists) {
        continue; // purged by the OS — leave the stale index entry out
      }
    }
    keys.push(fontKey);
  }
  return keys;
}

/** Delete a face from disk and the index. */
export async function removeRemoteFont(fontKey: string): Promise<void> {
  const index = await readIndex();
  const entry = index[fontKey];
  if (entry?.source === 'file') {
    try {
      const { File } = await import('expo-file-system');
      if (new File(entry.uri).exists) {
        new File(entry.uri).delete();
      }
    } catch {
      // Already gone — fine.
    }
  }
  delete index[fontKey];
  await writeIndex(index);
}

async function fetchFontBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Font download failed (${res.status}): ${url}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}
