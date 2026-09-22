import { packDesign } from '@/storage/design-file';
import type { MidadProject } from '@/storage/project-schema';
import { readBackgroundBytes } from '@/storage/projects';

/**
 * Build the `.midad` bytes for a design: its document plus the stored image.
 *
 * The image is read back as bytes and handed to the packer, so nothing is ever
 * re-encoded to base64 on the way out.
 */
export async function exportProjectFile(
  project: MidadProject,
): Promise<Uint8Array> {
  const bg = project.canvas.background;
  if (bg.type === 'image' && bg.imageFile) {
    const bytes = await readBackgroundBytes(project.id, bg.imageFile);
    if (bytes) {
      return packDesign(project, { bytes, mime: bg.imageMime ?? 'image/jpeg' });
    }
  }
  return packDesign(project, null);
}
