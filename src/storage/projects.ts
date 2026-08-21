import { File, Directory, Paths } from 'expo-file-system';

import type { MidadProject } from '@/storage/project-schema';
import { hasNativeFileSystem } from '@/storage/platform';

/**
 * Project persistence.
 *
 * Native: each design is a `.midad.json` file in the app Documents directory
 * (expo-file-system). Web: designs are stored as JSON strings in localStorage
 * (AsyncStorage's web backend), keyed by project id.
 *
 * The `loadList`/`save`/`remove` API is platform-agnostic.
 */

const DIR = 'midad-projects';
const LIST_KEY = 'midad:projects:index';

type ProjectIndex = Record<string, string>; // id -> filename / storage key

async function ensureDir(): Promise<Directory> {
  const dir = new Directory(Paths.document, DIR);
  if (!dir.exists) {
    dir.create({ idempotent: true, intermediates: true });
  }
  return dir;
}

function storageKey(id: string): string {
  return `midad:project:${id}`;
}

function fileName(id: string): string {
  return `${id}.midad.json`;
}

async function readIndex(): Promise<ProjectIndex> {
  if (hasNativeFileSystem) {
    const indexFile = new File(Paths.document, DIR, '.index.json');
    if (!indexFile.exists) {
      return {};
    }
    try {
      return JSON.parse(indexFile.textSync()) as ProjectIndex;
    } catch {
      return {};
    }
  }
  // Web: AsyncStorage-backed
  const { getItem } = await import('@/storage/storage');
  return (await getItem<ProjectIndex>(LIST_KEY)) ?? {};
}

async function writeIndex(index: ProjectIndex): Promise<void> {
  if (hasNativeFileSystem) {
    const dir = await ensureDir();
    const indexFile = dir.createFile('.index.json', 'application/json');
    indexFile.write(JSON.stringify(index));
    return;
  }
  const { setItem } = await import('@/storage/storage');
  await setItem(LIST_KEY, index);
}

export async function listProjects(): Promise<MidadProject[]> {
  const index = await readIndex();
  const projects: MidadProject[] = [];
  for (const id of Object.keys(index)) {
    const project = await loadProject(id);
    if (project) {
      projects.push(project);
    }
  }
  // Newest first.
  return projects.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function loadProject(id: string): Promise<MidadProject | null> {
  try {
    if (hasNativeFileSystem) {
      const dir = await ensureDir();
      const file = new File(dir, fileName(id));
      if (!file.exists) {
        return null;
      }
      return JSON.parse(file.textSync()) as MidadProject;
    }
    const { getItem } = await import('@/storage/storage');
    return await getItem<MidadProject>(storageKey(id));
  } catch {
    return null;
  }
}

export async function saveProject(project: MidadProject): Promise<void> {
  const index = await readIndex();
  index[project.id] = fileName(project.id);
  await writeIndex(index);

  if (hasNativeFileSystem) {
    const dir = await ensureDir();
    const file = new File(dir, fileName(project.id));
    if (file.exists) {
      file.delete();
    }
    file.create();
    file.write(JSON.stringify(project));
    return;
  }
  const { setItem } = await import('@/storage/storage');
  await setItem(storageKey(project.id), project);
}

export async function deleteProject(id: string): Promise<void> {
  const index = await readIndex();
  delete index[id];
  await writeIndex(index);

  if (hasNativeFileSystem) {
    try {
      const dir = await ensureDir();
      const file = new File(dir, fileName(id));
      if (file.exists) {
        file.delete();
      }
    } catch {
      // ignore missing file
    }
    return;
  }
  const { removeItem } = await import('@/storage/storage');
  await removeItem(storageKey(id));
}

export async function projectFileUri(id: string): Promise<string | null> {
  if (hasNativeFileSystem) {
    const dir = await ensureDir();
    const file = new File(dir, fileName(id));
    return file.exists ? file.uri : null;
  }
  return null;
}