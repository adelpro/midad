import { unpackDesign } from '@/storage/design-file';
import {
  PROJECT_FILE_VERSION,
  type MidadProject,
} from '@/storage/project-schema';
import {
  listProjects,
  saveProject,
  writeBackgroundBytes,
} from '@/storage/projects';

export type ImportStatus = 'ok' | 'bad-file' | 'bad-shape' | 'io-error';

/**
 * Read a `.midad` container and persist it as a new design. Always stamps a
 * fresh `updatedAt` and regenerates the id when it collides with an existing
 * project, so an import never overwrites local work.
 *
 * v2 only: a legacy `.midad.json`, a corrupt archive, or a document from
 * another version is refused as `bad-file`. There is no migration path.
 */
export async function importProjectFile(
  bytes: Uint8Array,
): Promise<ImportStatus> {
  const unpacked = unpackDesign(bytes);
  if (!unpacked) {
    return 'bad-file';
  }
  const { project: src, image } = unpacked;
  const canvasOk =
    typeof src.canvas === 'object' &&
    src.canvas !== null &&
    Number.isFinite(src.canvas.width) &&
    src.canvas.width > 0 &&
    Number.isFinite(src.canvas.height) &&
    src.canvas.height > 0;
  if (!canvasOk || !Array.isArray(src.objects)) {
    return 'bad-shape';
  }
  try {
    const list = await listProjects();
    const now = new Date().toISOString();
    const collision = list.some((x) => x.id === src.id);
    const id =
      collision || !src.id
        ? `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        : src.id;
    let background = src.canvas.background;
    if (background.type === 'image') {
      // A design whose image entry is missing falls back to paper rather than
      // importing a background that cannot be drawn.
      background = image
        ? {
            ...background,
            ...(await writeBackgroundBytes(id, image.bytes, image.mime)),
          }
        : { type: 'paper' };
    }
    const imported: MidadProject = {
      ...src,
      version: PROJECT_FILE_VERSION,
      id,
      canvas: { ...src.canvas, background },
      createdAt: typeof src.createdAt === 'string' ? src.createdAt : now,
      updatedAt: now,
    };
    await saveProject(imported);
    return 'ok';
  } catch {
    return 'io-error';
  }
}
