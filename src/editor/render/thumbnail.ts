import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';

import { renderProjectToPng } from '@/editor/render/offscreen';
import type { MidadProject } from '@/storage/project-schema';
import { saveThumb, THUMB_MAX_WIDTH_PX } from '@/storage/thumbs';

/**
 * Rasterize a design to its gallery thumbnail and store it.
 *
 * Thumbnails are best-effort wherever they are generated: every caller wraps
 * this in a try/catch, so a render failure (offscreen surface unavailable, or a
 * text-bearing design rendered before the fonts resolve) never blocks the save
 * or import that produced the design. The next successful generation repairs it.
 */
export async function saveProjectThumbnail(
  project: MidadProject,
  fonts: SkTypefaceFontProvider | null,
): Promise<void> {
  const png = renderProjectToPng(project, fonts, {
    maxWidthPx: THUMB_MAX_WIDTH_PX,
  });
  await saveThumb(project.id, png.base64DataUri);
}
