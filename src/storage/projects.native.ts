import { Directory, File, Paths } from 'expo-file-system';

import {
  imageEntryName,
  toPersisted,
  type StoredImage,
} from '@/storage/design-file';
import type { MidadProject } from '@/storage/project-schema';

/**
 * Native design storage: one **folder per design**.
 *
 * `midad-projects/<id>/design.json` holds the document and
 * `midad-projects/<id>/background.<ext>` the raw image bytes. The split is what
 * makes autosave cheap: a background only changes when one is picked, so the
 * periodic write touches the small document alone.
 *
 * There is no index file — the projects are the subdirectories, so the store
 * cannot disagree with itself.
 */

const DIR = 'midad-projects';
const DESIGN_FILE = 'design.json';
const IMAGE_PREFIX = 'background.';

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

/** Rebuild the in-memory data URI from the stored bytes. */
async function attachImageUri(
  project: MidadProject,
  dir: Directory,
): Promise<void> {
  const bg = project.canvas.background;
  if (bg.type !== 'image' || !bg.imageFile) {
    return;
  }
  const file = new File(dir, bg.imageFile);
  if (!file.exists) {
    return;
  }
  bg.imageUri = dataUri(bg.imageMime ?? 'image/jpeg', await file.base64());
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
    const project = JSON.parse(file.textSync()) as MidadProject;
    await attachImageUri(project, dir);
    return project;
  } catch {
    return null;
  }
}

export async function saveProject(project: MidadProject): Promise<void> {
  const dir = ensureProjectDir(project.id);
  writeFile(new File(dir, DESIGN_FILE), JSON.stringify(toPersisted(project)));
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
