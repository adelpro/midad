import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  imageEntryName,
  toPersisted,
  type StoredImage,
} from '@/storage/design-file';
import {
  normalizeProjectVersion,
  type MidadProject,
} from '@/storage/project-schema';

/**
 * Web design storage: one **key per file**, because `localStorage` is
 * string-only.
 *
 * `midad-projects:<id>` holds the document and `midad-projects:<id>:bg` the
 * background as a `data:` URI. Same split as native, same payoff — the periodic
 * write touches the small document alone. The image stays base64 here because
 * the medium has no bytes to give it.
 */

const KEY_PREFIX = 'midad-projects:';
const BG_SUFFIX = ':bg';

function designKey(id: string): string {
  return `${KEY_PREFIX}${id}`;
}

function backgroundKey(id: string): string {
  return `${KEY_PREFIX}${id}${BG_SUFFIX}`;
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

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function listProjects(): Promise<MidadProject[]> {
  const keys = await AsyncStorage.getAllKeys();
  const projects: MidadProject[] = [];
  for (const key of keys) {
    if (!key.startsWith(KEY_PREFIX) || key.endsWith(BG_SUFFIX)) {
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
}

export async function deleteProject(id: string): Promise<void> {
  try {
    await AsyncStorage.multiRemove([designKey(id), backgroundKey(id)]);
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
  if (!uri) {
    return null;
  }
  const comma = uri.indexOf(',');
  return base64ToBytes(comma === -1 ? uri : uri.slice(comma + 1));
}
