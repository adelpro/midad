import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { springs } from '@/theme';

/** Rise distance at the start of the entry, in dp. */
const RISE = 8;

/**
 * Entry motion for content that appears in place — editor strips, inline
 * notices, anything that materialises next to what the user is looking at.
 *
 * Mount-only by design: the parent owns when the content stops existing, and a
 * second copy hanging around mid-exit is worse than a hard cut. Opacity plus a
 * short rise only — never a layout property — so a strip appearing under the
 * canvas cannot re-lay-out the canvas itself.
 *
 * Styling goes on `style` so this adds no extra nesting level; Reduce Motion
 * keeps the cross-fade and drops the travel.
 */
export function Reveal({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    // Springs only (DESIGN.md §6/§8) — critically damped, so it reads as
    // ease-out without a duration tween.
    progress.value = withSpring(1, springs.ui);
  }, [progress]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduceMotion
      ? []
      : [{ translateY: (1 - progress.value) * RISE }],
  }));

  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>;
}
