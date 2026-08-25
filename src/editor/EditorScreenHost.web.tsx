import { ActivityIndicator, StyleSheet } from 'react-native';

import { SkiaCanvasBridge } from '@/components/skia/skia-canvas-bridge';
import { useTheme } from '@/hooks/use-theme';

/**
 * Web host: the editor body statically imports modules that reach
 * `@shopify/react-native-skia`. It must not be evaluated until CanvasKit
 * (WASM) has loaded, so it is pulled in through the `WithSkiaWeb` gate.
 */
export default function EditorScreenHost() {
  const { colors: c } = useTheme();
  return (
    <SkiaCanvasBridge
      getComponent={async () => ({
        default: (await import('@/editor/EditorScreen')).EditorScreen,
      })}
      fallback={<ActivityIndicator style={styles.fallback} color={c.muted} />}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1 },
});
