import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  assetEntryName,
  imageEntryName,
  toPersisted,
  type StoredImage,
} from '@/storage/design-file';
import { base64ToBytes } from '@/storage/base64';
import {
  normalizeProjectVersion,
  type MidadProject,
} from '@/storage/project-schema';

/**
 * Web design storage: one **key per file**, because `localStorage` is
 * string-only.
 *
 * `midad-projects:<id>` holds the document, `midad-projects:<id>:bg` the
 * background as a `data:` URI and `midad-projects:<id>:img:<objectId>` one
 * placed object's image, also as a `data:` URI. Same split as native, same
 * payoff — the periodic write touches the small document alone. The images stay
 * base64 here because the medium has no bytes to give them.
 */

const KEY_PREFIX = 'midad-projects:';
const BG_SUFFIX = ':bg';
const ASSET_MARKER = ':img:';

function designKey(id: string): string {
  return `${KEY_PREFIX}${id}`;
}

function backgroundKey(id: string): string {
  return `${KEY_PREFIX}${id}${BG_SUFFIX}`;
}

function assetKey(id: string, objectId: string): string {
  return `${KEY_PREFIX}${id}${ASSET_MARKER}${objectId}`;
}

/** The object id encoded in a `:img:` key for `id`, or `null`. */
function assetObjectId(id: string, key: string): string | null {
  const prefix = `${KEY_PREFIX}${id}${ASSET_MARKER}`;
  return key.startsWith(prefix) ? key.slice(prefix.length) : null;
}

/** Every `:img:` key for one design, read from the store's key list. */
async function assetKeys(id: string): Promise<string[]> {
  const prefix = `${KEY_PREFIX}${id}${ASSET_MARKER}`;
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((key) => key.startsWith(prefix));
}

function dataUri(mime: string, base64: string): string {
  return `data:${mime};base64,${base64}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64Body(uri: string): Uint8Array {
  const comma = uri.indexOf(',');
  return base64ToBytes(comma === -1 ? uri : uri.slice(comma + 1));
}

export async function listProjects(): Promise<MidadProject[]> {
  const keys = await AsyncStorage.getAllKeys();
  const projects: MidadProject[] = [];
  for (const key of keys) {
    if (
      !key.startsWith(KEY_PREFIX) ||
      key.endsWith(BG_SUFFIX) ||
      key.includes(ASSET_MARKER)
    ) {
      continue;
    }
    const project = await loadProject(key.slice(KEY_PREFIX.length));
    if (project) {
      projects.push(project);
    }
  }
  return projects.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function loadProject(id: string): Promise<MidadProject | null> {
  try {
    const raw = await AsyncStorage.getItem(designKey(id));
    if (!raw) {
      return null;
    }
    const project = normalizeProjectVersion(JSON.parse(raw) as unknown);
    if (!project) {
      return null;
    }
    const bg = project.canvas.background;
    if (bg.type === 'image') {
      const uri = await AsyncStorage.getItem(backgroundKey(id));
      if (uri) {
        bg.imageUri = uri;
      }
    }
    for (const object of project.objects) {
      if (object.type !== 'image' || !object.imageFile) {
        continue;
      }
      // A missing key leaves the object without a URI; the renderer degrades
      // rather than throwing.
      const uri = await AsyncStorage.getItem(assetKey(id, object.id));
      if (uri) {
        object.imageUri = uri;
      }
    }
    return project;
  } catch {
    return null;
  }
}

export async function saveProject(project: MidadProject): Promise<void> {
  await AsyncStorage.setItem(
    designKey(project.id),
    JSON.stringify(toPersisted(project)),
  );
  // One sweep, after the document is written: an object that a save reports as
  // present keeps its bytes, so undoing a delete is safe by construction.
  const live = new Set(project.objects.map((object) => object.id));
  const orphans = (await assetKeys(project.id)).filter((key) => {
    const objectId = assetObjectId(project.id, key);
    return objectId !== null && !live.has(objectId);
  });
  if (orphans.length > 0) {
    await AsyncStorage.multiRemove(orphans);
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    const keys = await assetKeys(id);
    await AsyncStorage.multiRemove([designKey(id), backgroundKey(id), ...keys]);
  } catch {
    // ignore a missing entry
  }
}

export async function writeBackgroundImage(
  id: string,
  base64: string,
  mime: string,
): Promise<StoredImage> {
  const imageUri = dataUri(mime, base64);
  await AsyncStorage.setItem(backgroundKey(id), imageUri);
  return { imageFile: imageEntryName(mime), imageMime: mime, imageUri };
}

export async function writeBackgroundBytes(
  id: string,
  bytes: Uint8Array,
  mime: string,
): Promise<StoredImage> {
  return writeBackgroundImage(id, bytesToBase64(bytes), mime);
}

export async function readBackgroundBytes(
  id: string,
  _imageFile: string,
): Promise<Uint8Array | null> {
  const uri = await AsyncStorage.getItem(backgroundKey(id));
  return uri ? base64Body(uri) : null;
}

/** Write one placed object's image, replacing any previous entry. */
export async function writeAssetBytes(
  id: string,
  objectId: string,
  bytes: Uint8Array,
  mime: string,
): Promise<StoredImage> {
  const imageUri = dataUri(mime, bytesToBase64(bytes));
  await AsyncStorage.setItem(assetKey(id, objectId), imageUri);
  return {
    imageFile: assetEntryName(objectId, mime),
    imageMime: mime,
    imageUri,
  };
}

/** Read one placed object's raw bytes, by the stem of its `imageFile`. */
export async function readAssetBytes(
  id: string,
  imageFile: string,
): Promise<Uint8Array | null> {
  const stem = imageFile.slice(imageFile.lastIndexOf('/') + 1).split('.')[0];
  const uri = await AsyncStorage.getItem(assetKey(id, stem));
  return uri ? base64Body(uri) : null;
}
