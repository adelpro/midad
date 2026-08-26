import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { motion } from '@/theme';

const PULSE_OPACITY = 0.55;

/** Themed placeholder block with a quiet UI-thread pulse (static under Reduce Motion). */
export function SkeletonBlock({
  width,
  height,
  radius = 3,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors: c } = useTheme();
  const reduceMotion = useReducedMotion();

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion
      ? 1
      : withRepeat(withTiming(PULSE_OPACITY, { duration: motion.base + 650 }), -1, true),
  }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: c.surfaceAlt },
        pulseStyle,
        style,
      ]}
    />
  );
}

/** Placeholder mirroring the gallery project card in either layout. */
export function ProjectCardSkeleton({
  layout,
  style,
}: {
  layout: 'stack' | 'row';
  style?: StyleProp<ViewStyle>;
}) {
  const { colors: c } = useTheme();
  return (
    <View
      style={[
        styles.card,
        layout === 'row' ? styles.cardRow : styles.cardStack,
        { backgroundColor: c.surface, borderColor: c.border },
        style,
      ]}>
      <SkeletonBlock
        radius={0}
        style={layout === 'row' ? styles.thumbRow : styles.thumbStack}
      />
      <View style={layout === 'row' ? styles.linesRow : styles.linesStack}>
        <SkeletonBlock style={styles.line} />
        <SkeletonBlock width="55%" style={styles.lineShort} />
      </View>
    </View>
  );
}

const THUMB_ROW_W = 116;
const THUMB_RATIO = 4 / 3;

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  cardStack: {
    flexGrow: 1,
    flexBasis: 150,
  },
  cardRow: {
    // Full width forces one card per line on phones, matching real cards.
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbStack: {
    aspectRatio: THUMB_RATIO,
  },
  thumbRow: {
    width: THUMB_ROW_W,
    height: THUMB_ROW_W / THUMB_RATIO,
  },
  linesStack: {
    padding: 12,
    gap: 12,
  },
  linesRow: {
    flex: 1,
    padding: 12,
    gap: 12,
  },
  line: {
    height: 10,
  },
  lineShort: {
    height: 8,
  },
});
