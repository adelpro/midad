import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MidadProject } from '@/storage/project-schema';

/**
 * Web implementation: browser localStorage (via AsyncStorage).
 * Mirrors the native file-based layout (index + one document per project).
 */

const INDEX_KEY = 'midad-projects.index';

function projectKey(id: string): string {
  return `midad-projects:${id}`;
}

function fileName(id: string): string {
  return `${id}.midad.json`;
}

async function readIndex(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

async function writeIndex(index: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
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
    const raw = await AsyncStorage.getItem(projectKey(id));
    return raw ? (JSON.parse(raw) as MidadProject) : null;
  } catch {
    return null;
  }
}

export async function saveProject(project: MidadProject): Promise<void> {
  const index = await readIndex();
  index[project.id] = fileName(project.id);
  await writeIndex(index);
  await AsyncStorage.setItem(projectKey(project.id), JSON.stringify(project));
}

export async function deleteProject(id: string): Promise<void> {
  const index = await readIndex();
  delete index[id];
  await writeIndex(index);

  try {
    await AsyncStorage.removeItem(projectKey(id));
  } catch {
    // ignore missing entry
  }
}
