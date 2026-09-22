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

export interface ImportResult {
  status: ImportStatus;
  /**
   * The persisted design on `ok`, ready to render (its `imageUri`, if any, is
   * attached). `null` on every failure. Thumbnails are the caller's job —
   * rendering needs the Skia font provider, which this storage module has no
   * business loading.
   */
  project: MidadProject | null;
}

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
): Promise<ImportResult> {
  const unpacked = unpackDesign(bytes);
  if (!unpacked) {
    return { status: 'bad-file', project: null };
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
    return { status: 'bad-shape', project: null };
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
    return { status: 'ok', project: imported };
  } catch {
    return { status: 'io-error', project: null };
  }
}
