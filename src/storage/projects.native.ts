import { Directory, File, Paths } from 'expo-file-system';

import {
  extensionForMime,
  imageEntryName,
  toPersisted,
  type StoredImage,
} from '@/storage/design-file';
import type { MidadProject } from '@/storage/project-schema';
import type { SaveOptions } from '@/storage/projects';
import { normalizeProjectVersion } from '@/storage/project-schema';

/**
 * Native design storage: one **folder per design**.
 *
 * `midad-projects/<id>/design.json` holds the document,
 * `midad-projects/<id>/background.<ext>` the raw background bytes and
 * `midad-projects/<id>/img_<objectId>.<ext>` one placed object's bytes. The
 * split is what makes autosave cheap: a background or an asset only changes
 * when it is picked, so the periodic write touches the small document alone.
 *
 * There is no index file — the projects are the subdirectories, so the store
 * cannot disagree with itself.
 */

const DIR = 'midad-projects';
const DESIGN_FILE = 'design.json';
const IMAGE_PREFIX = 'background.';
const ASSET_PREFIX = 'img_';

function ensureRoot(): Directory {
  const dir = new Directory(Paths.document, DIR);
  if (!dir.exists) {
    dir.create({ idempotent: true, intermediates: true });
  }
  return dir;
}

function projectDir(id: string): Directory {
  return new Directory(ensureRoot(), id);
}

function ensureProjectDir(id: string): Directory {
  const dir = projectDir(id);
  if (!dir.exists) {
    dir.create({ idempotent: true, intermediates: true });
  }
  return dir;
}

function basename(uri: string): string {
  const parts = uri.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

function dataUri(mime: string, base64: string): string {
  return `data:${mime};base64,${base64}`;
}

/** Write over a file, creating it if needed. `base64` decodes text to bytes. */
function writeFile(
  file: File,
  content: string | Uint8Array,
  base64 = false,
): void {
  if (file.exists) {
    file.delete();
  }
  file.create();
  if (base64 && typeof content === 'string') {
    file.write(content, { encoding: 'base64' });
  } else {
    file.write(content);
  }
}

/** Drop every stored image — the extension follows the MIME, so it can change. */
function clearImages(dir: Directory): void {
  for (const entry of dir.list()) {
    if (entry instanceof File && basename(entry.uri).startsWith(IMAGE_PREFIX)) {
      entry.delete();
    }
  }
}

/** The object id encoded in an `img_<objectId>.<ext>` file name, or `null`. */
function assetObjectId(fileName: string): string | null {
  if (!fileName.startsWith(ASSET_PREFIX)) {
    return null;
  }
  const rest = fileName.slice(ASSET_PREFIX.length);
  const dot = rest.indexOf('.');
  return dot === -1 ? rest : rest.slice(0, dot);
}

/**
 * The **device** file name for one placed object's bytes.
 *
 * Deliberately not `assetEntryName` (the `.midad` ZIP entry, `assets/<id>.<ext>`):
 * that is a path inside an archive, and the device store writes into a flat
 * project directory. Passing an archive path to `File.create()` asks for a
 * subdirectory nobody created — the write throws on Android and silently
 * produces no file on iOS.
 *
 * The `img_` prefix is what `assetObjectId` and `sweepOrphans` parse, so the
 * name and the sweep have to agree; this function is that agreement.
 */
function assetFileName(objectId: string, mime: string): string {
  return `${ASSET_PREFIX}${objectId}.${extensionForMime(mime)}`;
}

/** Rebuild the in-memory data URIs from the stored bytes. */
async function attachImageUri(
  project: MidadProject,
  dir: Directory,
): Promise<void> {
  const bg = project.canvas.background;
  if (bg.type === 'image' && bg.imageFile) {
    const file = new File(dir, bg.imageFile);
    if (file.exists) {
      bg.imageUri = dataUri(bg.imageMime ?? 'image/jpeg', await file.base64());
    }
  }
  for (const object of project.objects) {
    if (object.type !== 'image' || !object.imageFile) {
      continue;
    }
    const file = new File(dir, object.imageFile);
    // A missing file leaves the object without a URI; the renderer degrades
    // rather than throwing.
    if (file.exists) {
      object.imageUri = dataUri(
        object.imageMime ?? 'image/jpeg',
        await file.base64(),
      );
    }
  }
}

/**
 * Delete every `img_*` file whose object id is neither in the document nor in
 * `retain`.
 *
 * `retain` carries the ids a reachable undo/redo step still holds. Without it the
 * sweep deletes the bytes of an object the user deleted but can still undo, and
 * the restored object renders empty.
 */
function sweepOrphans(
  dir: Directory,
  project: MidadProject,
  retain: readonly string[] = [],
): void {
  const live = new Set(project.objects.map((object) => object.id));
  for (const id of retain) {
    live.add(id);
  }
  for (const entry of dir.list()) {
    if (!(entry instanceof File)) {
      continue;
    }
    const objectId = assetObjectId(basename(entry.uri));
    if (objectId !== null && !live.has(objectId)) {
      entry.delete();
    }
  }
}

export async function listProjects(): Promise<MidadProject[]> {
  const dir = ensureRoot();
  const projects: MidadProject[] = [];
  for (const entry of dir.list()) {
    if (!(entry instanceof Directory)) {
      continue;
    }
    const project = await loadProject(basename(entry.uri));
    if (project) {
      projects.push(project);
    }
  }
  return projects.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function loadProject(id: string): Promise<MidadProject | null> {
  try {
    const dir = projectDir(id);
    const file = new File(dir, DESIGN_FILE);
    if (!file.exists) {
      return null;
    }
    const project = normalizeProjectVersion(
      JSON.parse(file.textSync()) as unknown,
    );
    if (!project) {
      return null;
    }
    await attachImageUri(project, dir);
    return project;
  } catch {
    return null;
  }
}

export async function saveProject(
  project: MidadProject,
  options: SaveOptions = {},
): Promise<void> {
  const dir = ensureProjectDir(project.id);
  writeFile(new File(dir, DESIGN_FILE), JSON.stringify(toPersisted(project)));
  // The sweep runs after the document is written. `retainObjectIds` is what makes
  // it safe for undo: a deleted object is absent from the document, so presence
  // alone cannot tell the sweep whether the user can still bring it back.
  sweepOrphans(dir, project, options.retainObjectIds);
}

export async function deleteProject(id: string): Promise<void> {
  try {
    const dir = projectDir(id);
    if (dir.exists) {
      dir.delete();
    }
  } catch {
    // ignore a missing directory
  }
}

export async function writeBackgroundImage(
  id: string,
  base64: string,
  mime: string,
): Promise<StoredImage> {
  const dir = ensureProjectDir(id);
  clearImages(dir);
  const imageFile = imageEntryName(mime);
  writeFile(new File(dir, imageFile), base64, true);
  return { imageFile, imageMime: mime, imageUri: dataUri(mime, base64) };
}

export async function writeBackgroundBytes(
  id: string,
  bytes: Uint8Array,
  mime: string,
): Promise<StoredImage> {
  const dir = ensureProjectDir(id);
  clearImages(dir);
  const imageFile = imageEntryName(mime);
  const file = new File(dir, imageFile);
  writeFile(file, bytes);
  return {
    imageFile,
    imageMime: mime,
    imageUri: dataUri(mime, await file.base64()),
  };
}

export async function readBackgroundBytes(
  id: string,
  imageFile: string,
): Promise<Uint8Array | null> {
  try {
    const file = new File(projectDir(id), imageFile);
    return file.exists ? await file.bytes() : null;
  } catch {
    return null;
  }
}

/** Write one placed object's image bytes, replacing any previous extension. */
export async function writeAssetBytes(
  id: string,
  objectId: string,
  bytes: Uint8Array,
  mime: string,
): Promise<StoredImage> {
  const dir = ensureProjectDir(id);
  const imageFile = assetFileName(objectId, mime);
  // The MIME, and therefore the extension, can change, so drop the old one.
  for (const entry of dir.list()) {
    if (
      entry instanceof File &&
      basename(entry.uri).startsWith(`${ASSET_PREFIX}${objectId}.`)
    ) {
      entry.delete();
    }
  }
  const file = new File(dir, imageFile);
  writeFile(file, bytes);
  return {
    imageFile,
    imageMime: mime,
    imageUri: dataUri(mime, await file.base64()),
  };
}

export async function readAssetBytes(
  id: string,
  imageFile: string,
): Promise<Uint8Array | null> {
  try {
    const file = new File(projectDir(id), imageFile);
    return file.exists ? await file.bytes() : null;
  } catch {
    return null;
  }
}
