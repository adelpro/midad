import { ActivityIndicator, StyleSheet } from 'react-native';

import { SkiaCanvasBridge } from '@/components/skia/skia-canvas-bridge';
import { useTheme } from '@/hooks/use-theme';
import type { EditorCanvasProps } from '@/editor/EditorCanvas';

/**
 * Web host: CanvasKit (WASM) must finish loading before any Skia component
 * renders. `WithSkiaWeb` loads `public/canvaskit.wasm`, then code-splits in
 * the real canvas module. Props are forwarded once it's ready.
 */
export function EditorCanvasHost(props: EditorCanvasProps) {
  const { colors: c } = useTheme();
  return (
    <SkiaCanvasBridge
      getComponent={async () => ({
        default: (await import('@/editor/EditorCanvas')).EditorCanvas,
      })}
      fallback={<ActivityIndicator style={styles.fallback} color={c.muted} />}
      componentProps={props as unknown as Record<string, unknown>}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1 },
});
