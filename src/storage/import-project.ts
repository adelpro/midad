import type { MidadProject } from '@/storage/project-schema';
import { listProjects, saveProject } from '@/storage/projects';

export type ImportStatus =
  'ok' | 'bad-json' | 'bad-version' | 'bad-shape' | 'io-error';

/**
 * Parse and persist an imported `.midad.json` document. Always stamps a
 * fresh updatedAt and regenerates the id when it collides with an existing
 * project so imports never overwrite local work.
 */
export async function importProjectFromJson(
  text: string,
): Promise<ImportStatus> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return 'bad-json';
  }
  if (typeof data !== 'object' || data === null) {
    return 'bad-shape';
  }
  const p = data as Partial<MidadProject>;
  const canvasOk =
    typeof p.canvas === 'object' &&
    p.canvas !== null &&
    Number.isFinite(p.canvas.width) &&
    p.canvas.width > 0 &&
    Number.isFinite(p.canvas.height) &&
    p.canvas.height > 0;
  if (!canvasOk || !Array.isArray(p.objects)) {
    return 'bad-shape';
  }
  if (p.version !== 1) {
    return 'bad-version';
  }
  try {
    const list = await listProjects();
    const now = new Date().toISOString();
    const collision = list.some((x) => x.id === p.id);
    const imported: MidadProject = {
      ...(data as MidadProject),
      version: 1,
      id:
        collision || !p.id
          ? `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
          : p.id,
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : now,
      updatedAt: now,
    };
    await saveProject(imported);
    return 'ok';
  } catch {
    return 'io-error';
  }
}
