import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useT } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';

import { BrandMark } from './brand-mark';

/** Half a breath, so one full cycle is 900 ms (spec §9). */
const HALF = 450;
const SCALE_HI = 1.03;
const SCALE_LO = 0.98;
const OPACITY_LO = 0.75;

export interface BrandLoaderProps {
  /** Rendered height of the mark in dp; width follows the source aspect ratio. */
  height?: number;
  /** Progressbar label; defaults to the app name. */
  label?: string;
}

/**
 * A soft pulse of the brand mark — a loading cover for the wait before the
 * editor can draw a design's real faces.
 *
 * Scale and opacity run off **one** shared value rather than two loops: the two
 * channels are supposed to move as a single breath, and a second independent
 * loop can drift out of phase with the first, which reads as a stutter instead
 * of a vibration. `phase` is the scale itself, so Reduce Motion — which skips the
 * loop and leaves it at its initial 1 — rests the mark mid-breath at scale 1 /
 * opacity 0.85, which is the interior of the cycle rather than either extreme.
 * Freezing it at `SCALE_HI` instead would show a zoomed-in logo as the resting
 * state, which reads as a rendering fault.
 *
 * No Skia and no `pathLength`: both are web-hostile here (see spec §9), and a
 * transform-and-opacity pulse is one implementation on web, Android and iOS.
 */
export function BrandLoader({ height = 96, label }: BrandLoaderProps) {
  const { colors: c } = useTheme();
  const { t } = useT();
  const reduceMotion = useReducedMotion();
  const phase = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    phase.value = withRepeat(
      withSequence(
        withTiming(SCALE_HI, { duration: HALF }),
        withTiming(SCALE_LO, { duration: HALF }),
      ),
      -1,
      true,
    );
    return () => cancelAnimation(phase);
  }, [phase, reduceMotion]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      phase.value,
      [SCALE_LO, SCALE_HI],
      [OPACITY_LO, 1],
      'clamp',
    ),
    transform: [{ scale: phase.value }],
  }));

  return (
    <View
      style={[styles.cover, { backgroundColor: c.paper }]}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? t.appName}
    >
      <Animated.View style={pulseStyle}>
        <BrandMark height={height} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
