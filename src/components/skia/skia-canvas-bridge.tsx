import { Platform } from 'react-native';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

export interface SkiaCanvasBridgeProps {
  /**
   * Lazily imports the editor canvas module. Must resolve to a component whose
   * default export renders the Skia `<Canvas>`. Lives outside `src/app/` so
   * expo-router does not evaluate it before CanvasKit loads on web.
   */
  getComponent: () => Promise<{ default: React.ComponentType<any> }>;
  fallback?: React.ReactNode;
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
export function SkiaCanvasBridge({ getComponent, fallback }: SkiaCanvasBridgeProps) {
  if (Platform.OS !== 'web') {
    return null;
  }
  return <WithSkiaWeb getComponent={getComponent} fallback={fallback} />;
}