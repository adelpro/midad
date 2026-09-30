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
  // The document's own display faces first: `loadParagraphFonts` registers a
  // display face only once expo-font has loaded it, so skipping this would pin
  // the imported thumbnail to Amiri.
  const [
    { ensureBundledFonts },
    { bundledDisplayKeysFor },
    { displayFontKeys },
  ] = await Promise.all([
    import('@/storage/bundled-font-registry'),
    import('@/theme/bundled-fonts'),
    import('@/theme'),
  ]);
  const [
    { loadParagraphFonts, publishParagraphFonts, projectFontKeys },
    { saveProjectThumbnail },
  ] = await Promise.all([
    import('@/editor/skia/text'),
    import('@/editor/render/thumbnail'),
  ]);
  await ensureBundledFonts(
    bundledDisplayKeysFor(projectFontKeys(project), displayFontKeys),
  );
  const built = await loadParagraphFonts();
  // `saveProjectThumbnail` shapes through `buildParagraph`, which resolves the
  // family against the module mirror — so this one-off build has to publish it,
  // there being no editor hook to do it. Nobody is rendering this provider
  // afterwards, and it is disposed below either way.
  publishParagraphFonts(built);
  try {
    await saveProjectThumbnail(project, built.fonts);
  } finally {
    // One-off provider: the render is synchronous, so it can be released now
    // instead of living for the app's lifetime like the editor's.
    built.fonts.dispose();
  }
}
