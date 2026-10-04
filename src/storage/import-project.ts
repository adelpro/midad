import { copyImageAssets } from '@/storage/copy-assets';
import { assetEntryName, unpackDesign } from '@/storage/design-file';
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
 * Accepts a version-2 or version-3 document: `unpackDesign` normalizes a v2 one
 * to v3 (see `docs/storage-format.md` §6), which is what lets an older `.midad`
 * still open. A **v1** archive, a future version, or a corrupt file is refused as
 * `bad-file`.
 *
 * Every placed image's bytes are written before the document is saved — the same
 * order the background has always used, because `saveProject` writes the document
 * alone. Skipping it imports the objects with references to bytes that were never
 * written, and they render empty: silent loss of the user's own content.
 */
export async function importProjectFile(
  bytes: Uint8Array,
): Promise<ImportResult> {
  const unpacked = unpackDesign(bytes);
  if (!unpacked) {
    return { status: 'bad-file', project: null };
  }
  const { project: src, image, assets } = unpacked;
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
    // Every placed image's bytes, out of the archive and into the store.
    //
    // The lookup goes through `assetEntryName` rather than comparing the entry
    // name to the object's own `imageFile`: those are **two different names for
    // the same bytes**. The archive entry is `assets/<objectId>.<ext>` and the
    // device file is `img_<objectId>.<ext>`, so a match on `imageFile` finds
    // nothing at all — which is how a round-tripped design lost every one of its
    // images while importing without an error.
    await copyImageAssets(imported, id, async (object) => {
      const asset = assets.find(
        (a) => a.name === assetEntryName(object.id, object.imageMime),
      );
      return asset ? { bytes: asset.bytes, mime: asset.mime } : null;
    });
    await saveProject(imported);
    return { status: 'ok', project: imported };
  } catch {
    return { status: 'io-error', project: null };
  }
}
