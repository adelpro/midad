import { Directory, File, Paths } from 'expo-file-system';

import type { MidadProject } from '@/storage/project-schema';

const DIR = 'midad-projects';

async function ensureDir(): Promise<Directory> {
  const dir = new Directory(Paths.document, DIR);
  if (!dir.exists) {
    dir.create({ idempotent: true, intermediates: true });
  }
  return dir;
}

function fileName(id: string): string {
  return `${id}.midad.json`;
}

async function readIndex(): Promise<Record<string, string>> {
  const dir = await ensureDir();
  const indexFile = new File(dir, '.index.json');
  if (!indexFile.exists) {
    return {};
  }
  try {
    return JSON.parse(indexFile.textSync()) as Record<string, string>;
  } catch {
    return {};
  }
}

async function writeIndex(index: Record<string, string>): Promise<void> {
  const dir = await ensureDir();
  const indexFile = dir.createFile('.index.json', 'application/json');
  indexFile.write(JSON.stringify(index));
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
  return projects.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function loadProject(id: string): Promise<MidadProject | null> {
  try {
    const dir = await ensureDir();
    const file = new File(dir, fileName(id));
    if (!file.exists) {
      return null;
    }
    return JSON.parse(file.textSync()) as MidadProject;
  } catch {
    return null;
  }
}

export async function saveProject(project: MidadProject): Promise<void> {
  const index = await readIndex();
  index[project.id] = fileName(project.id);
  await writeIndex(index);

  const dir = await ensureDir();
  const file = new File(dir, fileName(project.id));
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(JSON.stringify(project));
}

export async function deleteProject(id: string): Promise<void> {
  const index = await readIndex();
  delete index[id];
  await writeIndex(index);

  try {
    const dir = await ensureDir();
    const file = new File(dir, fileName(id));
    if (file.exists) {
      file.delete();
    }
  } catch {
    // ignore missing file
  }
}
