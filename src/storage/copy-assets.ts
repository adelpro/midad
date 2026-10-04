/**
 * Copying a design's image bytes to a new id.
 *
 * Three paths need this and must agree: **duplicate** (gallery), **import** (a
 * `.midad` archive) and anything added later. They arrive with the bytes in
 * different places — import reads them out of the archive, duplicate reads them
 * out of the store — so this takes them as a lookup and does the writing, rather
 * than each caller re-deriving which files a document references.
 *
 * The background is deliberately not handled here: it is not an object, and the
 * two callers already treat it as their own case (import falls back to paper when
 * its entry is missing; duplicate copies it before this runs).
 */

import { readAssetBytes, writeAssetBytes } from '@/storage/projects';
import type { DesignObject, MidadProject } from '@/storage/project-schema';

/** A placed-image object, the only kind that owns stored bytes. */
export type ImageAssetObject = Extract<DesignObject, { type: 'image' }>;

/** The placed-image objects in a document, in order. */
export function imageObjects(
  objects: readonly DesignObject[],
): ImageAssetObject[] {
  return objects.filter((o): o is ImageAssetObject => o.type === 'image');
}

/**
 * Write every placed image's bytes under `targetId`.
 *
 * `read` supplies the bytes for one object and returns `null` when they are not
 * available. It takes the **object**, not its `imageFile`, because the source
 * names the bytes differently depending on where they are being read from: an
 * archive entry is `assets/<objectId>.<ext>` (from `assetEntryName`) while a
 * device file is `img_<objectId>.<ext>`. Handing the reader only `imageFile`
 * forced a name comparison that silently matched nothing.
 *
 * A missing source is **not** fatal: the object comes across with its `imageFile`
 * intact and simply has no bytes yet, which is the same degradation a design with
 * a dropped entry gets (see `docs/storage-format.md` §4). Dropping the object
 * instead would silently reshape the user's design.
 *
 * Each object is written under its own id, so a document with several images —
 * or the same image twice — copies each one independently.
 */
export async function copyImageAssets(
  source: Pick<MidadProject, 'id' | 'objects'>,
  targetId: string,
  read: (
    object: ImageAssetObject,
  ) => Promise<{ bytes: Uint8Array; mime: string } | null>,
): Promise<void> {
  for (const object of imageObjects(source.objects)) {
    const bytes = await read(object);
    if (!bytes) {
      continue;
    }
    await writeAssetBytes(targetId, object.id, bytes.bytes, bytes.mime);
  }
}

/**
 * `copyImageAssets` for the duplicate path: read each object's bytes from the
 * store the design already lives in, where they are named by the object's own
 * `imageFile`.
 */
export async function copyImageAssetsFromStore(
  source: Pick<MidadProject, 'id' | 'objects'>,
  targetId: string,
): Promise<void> {
  await copyImageAssets(source, targetId, async (object) => {
    const bytes = await readAssetBytes(source.id, object.imageFile);
    return bytes ? { bytes, mime: object.imageMime } : null;
  });
}

/**
 * The MIME for a stored file name.
 *
 * The document's `imageMime` is the authority for rendering and is what the
 * object already carries; this exists only because `writeAssetBytes` needs a MIME
 * to choose the extension, and the extension it is given here is the one the file
 * already has.
 */
