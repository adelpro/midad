import { Platform } from 'react-native';

import { canvaskitWasmUrl } from '@/storage/platform';
import type { MidadProject } from '@/storage/project-schema';

/**
 * Rasterize an imported design's thumbnail, loading CanvasKit first on web.
 *
 * This module is a dynamic-import boundary on purpose. Everything it pulls in
 * reaches `@shopify/react-native-skia`, and Skia's web singleton captures
 * `global.CanvasKit` at *module-evaluation* time
 * (`export const Skia = JsiSkApi(global.CanvasKit)`). The gallery is the web
 * landing route, so importing that graph — or calling a Skia hook like
 * `useParagraphFonts` — during render left `Skia` holding an undefined
 * CanvasKit and threw
 * "can't access property \"Typeface\", this.CanvasKit is undefined" the moment
 * `Data.fromURI` resolved. Here the wasm is fetched only when the user actually
 * imports, matching the editor's `WithSkiaWeb` gate — triggered by an event
 * instead of a render.
 */
export async function renderImportedThumbnail(
  project: MidadProject,
): Promise<void> {
  if (Platform.OS === 'web') {
    const { LoadSkiaWeb } =
      await import('@shopify/react-native-skia/lib/module/web');
    await LoadSkiaWeb({ locateFile: () => canvaskitWasmUrl() });
  }
  const [{ loadParagraphFonts }, { saveProjectThumbnail }] = await Promise.all([
    import('@/editor/skia/text'),
    import('@/editor/render/thumbnail'),
  ]);
  const { fonts } = await loadParagraphFonts();
  try {
    await saveProjectThumbnail(project, fonts);
  } finally {
    // One-off provider: the render is synchronous, so it can be released now
    // instead of living for the app's lifetime like the editor's.
    fonts.dispose();
  }
}
