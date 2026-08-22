import { memo, useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/theme';

export interface StepPagerProps {
  count: number;
  index: number;
  onIndexChange: (index: number) => void;
  renderStep: (index: number) => React.ReactNode;
  isRTL?: boolean;
}

/**
 * Self-coded horizontal pager for onboarding.
 *
 * One content strip translated by `-index * width`. Pan gestures slide and
 * snap to the nearest step; taps/CTAs call `setIndex`. RTL-aware (swipe
 * direction mirrors). No third-party pager dependency.
 */
function StepPagerBase({ count, index, onIndexChange, renderStep, isRTL = false }: StepPagerProps) {
  const { width } = useWindowDimensions();

  const x = useSharedValue(-index * width);
  const gestureStartX = useSharedValue(0);
  const current = useSharedValue(index);

  // Sync shared values with the React index (CTA-driven jumps). Runs after
  // render, never during it, to satisfy Reanimated's strict-mode checks.
  useEffect(() => {
    if (current.value === index) {
      return;
    }
    current.value = index;
    x.value = withTiming(-index * width, { duration: motion.base });
  }, [index, width, x, current]);

  // Keep the initial offset correct when the viewport width changes.
  useEffect(() => {
    x.value = withTiming(-current.value * width, { duration: 0 });
  }, [width, x, current]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      gestureStartX.value = x.value;
    })
    .onUpdate((e) => {
      // In RTL the strip still translates the same way; direction mirrors.
      x.value = gestureStartX.value + e.translationX;
    })
    .onEnd((e) => {
      const dir = isRTL ? -1 : 1;
      const half = width / 2;
      let target = current.value;
      if (e.velocityX * dir < -400) {
        target = Math.min(count - 1, target + 1);
      } else if (e.velocityX * dir > 400) {
        target = Math.max(0, target - 1);
      } else if (e.translationX * dir < -half) {
        target = Math.min(count - 1, target + 1);
      } else if (e.translationX * dir > half) {
        target = Math.max(0, target - 1);
      }
      current.value = target;
      x.value = withTiming(-target * width, { duration: motion.base });
      if (target !== index) {
        runOnJS(onIndexChange)(target);
      }
    });

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={styles.viewport}>
        <Animated.View style={[styles.strip, { width: width * count }, stripStyle]}>
          {Array.from({ length: count }, (_, i) => (
            <View key={i} style={{ width, flex: 1 }}>
              {renderStep(i)}
            </View>
          ))}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

export const StepPager = memo(StepPagerBase);

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    overflow: 'hidden',
  },
  strip: {
    flexDirection: 'row',
    flex: 1,
  },
});