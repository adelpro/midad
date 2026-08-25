import { Platform } from 'react-native';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

import { canvaskitWasmUrl } from '@/storage/platform';

export interface SkiaCanvasBridgeProps {
  /**
   * Lazily imports the editor canvas module. Must resolve to a component whose
   * default export renders the Skia `<Canvas>`. Lives outside `src/app/` so
   * expo-router does not evaluate it before CanvasKit loads on web.
   */
  getComponent: () => Promise<{ default: React.ComponentType<any> }>;
  fallback?: React.ReactNode;
  /** Props forwarded to the lazily-loaded component once CanvasKit is ready. */
  componentProps?: Record<string, unknown>;
}

/**
 * Web-only entry point for Skia content.
 *
 * On web, `WithSkiaWeb` loads CanvasKit (the wasm in `public/canvaskit.wasm`)
 * then code-splits in the canvas component. On native, callers import the
 * canvas directly — this bridge is not used.
 *
 * Use `Platform.OS === 'web' ? <SkiaCanvasBridge ... /> : <RealCanvas />`.
 */
export function SkiaCanvasBridge({ getComponent, fallback, componentProps }: SkiaCanvasBridgeProps) {
  if (Platform.OS !== 'web') {
    return null;
  }
  return (
    <WithSkiaWeb
      getComponent={getComponent}
      fallback={fallback}
      componentProps={componentProps}
      // Without locateFile, canvaskit-wasm resolves the .wasm relative to the
      // Metro bundle URL (/node_modules/...) which does not exist.
      opts={{ locateFile: () => canvaskitWasmUrl() }}
    />
  );
}