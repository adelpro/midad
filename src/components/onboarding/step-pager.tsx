import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { motion } from "@/theme";

export interface StepPagerProps {
  count: number;
  index: number;
  onIndexChange: (index: number) => void;
  renderStep: (index: number) => React.ReactNode;
  isRTL?: boolean;
  /** Floor for the step area so the content cannot collapse in a scroll parent. */
  minHeight?: number;
}

/**
 * Self-coded horizontal pager for onboarding.
 *
 * Sizing contract: the pager measures **its own** width via `onLayout` and
 * sizes every page to exactly that, then translates the strip in whole-page
 * steps. It deliberately never pairs `flex: 1` with an explicit `width`: a
 * positive `flex` sets the flex base size, which overrides `width` on the main
 * axis (Yoga's `processFlexBasis` returns 0 for any positive `flex`), so the
 * two together silently produce `containerWidth / count` pages that no longer
 * line up with the translate step.
 *
 * Measuring the container rather than the window also lets the screen cap its
 * content width on large displays without the pager drifting out of sync.
 *
 * Pages are placed with a physical `left` instead of a flex row, so page order
 * is identical under LTR and RTL. RTL only changes which physical side the
 * first step occupies (slots reverse) and which swipe direction is "forward".
 */
function StepPagerBase({
  count,
  index,
  onIndexChange,
  renderStep,
  isRTL = false,
  minHeight,
}: StepPagerProps) {
  const [pageWidth, setPageWidth] = useState(0);
  const viewportRef = useRef<View>(null);
  const { width: windowWidth } = useWindowDimensions();

  // Page `i` sits in slot `i` in LTR. In RTL the first step is right-most, so
  // slots reverse and advancing moves the strip toward the leading (left) edge.
  const slotFor = useCallback(
    (i: number) => (isRTL ? count - 1 - i : i),
    [count, isRTL],
  );

  const x = useSharedValue(0);
  const gestureStartX = useSharedValue(0);
  const gestureStartTranslation = useSharedValue(0);
  const current = useSharedValue(index);

  /** Ignore non-positive reads — a hidden container must not blank the pager. */
  const applyWidth = useCallback((next: number) => {
    if (!(next > 0)) {
      return;
    }
    setPageWidth((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
  }, []);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => applyWidth(e.nativeEvent.layout.width),
    [applyWidth],
  );

  // `onLayout` alone is not enough: a page that mounts while its tab is
  // backgrounded sees a zero-width viewport and then gets no further layout
  // pass, which would leave the pager permanently blank. Re-measure whenever
  // the window metrics change so it always recovers.
  useEffect(() => {
    const node = viewportRef.current as unknown as {
      measure?: (
        cb: (x: number, y: number, w: number, h: number) => void,
      ) => void;
      getBoundingClientRect?: () => { width: number };
    } | null;
    if (!node) {
      return;
    }
    if (typeof node.getBoundingClientRect === "function") {
      applyWidth(node.getBoundingClientRect().width);
    } else if (typeof node.measure === "function") {
      node.measure((_x, _y, w) => applyWidth(w));
    }
  }, [applyWidth, windowWidth]);

  // Sync shared values with the React index (CTA-driven jumps). Runs after
  // render, never during it, to satisfy Reanimated's strict-mode checks.
  useEffect(() => {
    if (pageWidth === 0 || current.value === index) {
      return;
    }
    const slot = isRTL ? count - 1 - index : index;
    current.value = index;
    x.value = withTiming(-slot * pageWidth, { duration: motion.base });
  }, [index, count, isRTL, pageWidth, x, current]);

  // Re-align instantly when the viewport resizes — animating here would read as
  // a slide the user never asked for.
  useEffect(() => {
    if (pageWidth === 0) {
      return;
    }
    const slot = isRTL ? count - 1 - current.value : current.value;
    // Reanimated shared values are intentionally mutated here; the compiler's
    // immutability rule does not model shared-value writes in effects.
    // eslint-disable-next-line react-hooks/immutability
    x.value = -slot * pageWidth;
  }, [pageWidth, count, isRTL, x, current]);

  const pan = Gesture.Pan()
    // Let vertical drags fall through to the surrounding ScrollView; only claim
    // the gesture once it is unambiguously horizontal.
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onStart((e) => {
      // Anchor to the strip position at *activation*, remembering the
      // translation already consumed by the activation threshold, so the strip
      // does not jump when the gesture takes over.
      gestureStartX.value = x.value;
      gestureStartTranslation.value = e.translationX;
    })
    .onUpdate((e) => {
      // eslint-disable-next-line react-hooks/immutability
      x.value =
        gestureStartX.value + (e.translationX - gestureStartTranslation.value);
    })
    .onEnd((e) => {
      const dir = isRTL ? -1 : 1;
      const half = pageWidth / 2;
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
      const slot = isRTL ? count - 1 - target : target;
      // eslint-disable-next-line react-hooks/immutability
      current.value = target;
      // eslint-disable-next-line react-hooks/immutability
      x.value = withTiming(-slot * pageWidth, { duration: motion.base });
      if (target !== index) {
        runOnJS(onIndexChange)(target);
      }
    });

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return (
    <View
      ref={viewportRef}
      style={[styles.viewport, minHeight ? { minHeight } : null]}
      onLayout={onLayout}
    >
      <GestureDetector gesture={pan}>
        <View style={styles.gestureArea}>
          {/* Nothing renders until the container is measured: laying the pages
              out at a guessed width would flash a mis-aligned slide. */}
          {pageWidth > 0 && (
            <Animated.View
              style={[styles.strip, { width: pageWidth * count }, stripStyle]}
            >
              {Array.from({ length: count }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.page,
                    { width: pageWidth, left: slotFor(i) * pageWidth },
                  ]}
                >
                  {renderStep(i)}
                </View>
              ))}
            </Animated.View>
          )}
        </View>
      </GestureDetector>
    </View>
  );
}

export const StepPager = memo(StepPagerBase);

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    overflow: "hidden",
  },
  // The gesture target is a separate node from the measured box, so the ref and
  // `onLayout` on the parent are unaffected by how the gesture library wraps or
  // clones its child.
  gestureArea: {
    flex: 1,
  },
  // The strip and its pages both use absolute positioning with a physical `left`
  // so page order never depends on the ambient writing direction.
  strip: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
  },
  page: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
});
