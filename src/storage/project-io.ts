import { assetEntryName, packDesign } from '@/storage/design-file';
import type { MidadProject } from '@/storage/project-schema';
import { readAssetBytes, readBackgroundBytes } from '@/storage/projects';

/**
 * Build the `.midad` bytes for a design: its document, its background image,
 * and every placed object's stored bytes as a named `assets/` entry.
 *
 * The bytes are read back and handed to the packer, so nothing is ever
 * re-encoded to base64 on the way out.
 */
export async function exportProjectFile(
  project: MidadProject,
): Promise<Uint8Array> {
  const assets = [];
  for (const object of project.objects) {
    if (object.type !== 'image') {
      continue;
    }
    const bytes = await readAssetBytes(project.id, object.imageFile);
    if (bytes) {
      assets.push({
        name: assetEntryName(object.id, object.imageMime),
        bytes,
        mime: object.imageMime,
      });
    }
  }
  const bg = project.canvas.background;
  if (bg.type === 'image' && bg.imageFile) {
    const bytes = await readBackgroundBytes(project.id, bg.imageFile);
    if (bytes) {
      return packDesign(
        project,
        { bytes, mime: bg.imageMime ?? 'image/jpeg' },
        assets,
      );
    }
  }
  return packDesign(project, null, assets);
}
