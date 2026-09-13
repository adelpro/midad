import type { PropsWithChildren } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/use-theme";
import { radius, spacing, springs } from "@/theme";

export interface SheetProps extends PropsWithChildren {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Present content in a centered modal instead of bottom sheet. */
  presentation?: "bottom" | "modal";
}

/** Fraction of the panel that must be dragged away before release dismisses. */
const DISMISS_RATIO = 0.3;
/** A flick faster than this dismisses regardless of distance (pt/s). */
const DISMISS_VELOCITY = 800;
/** Upward over-drag is resisted to this fraction of the raw translation. */
const UPWARD_RESISTANCE = 0.15;

/**
 * Bottom sheet. Crisp 12px top radius, hairline border, ultra-diffuse shadow.
 *
 * Motion is a spring slide with drag-to-dismiss and velocity handoff
 * (DESIGN.md §4/§6), not the `Modal` fade: the panel is driven by a Reanimated
 * shared value so a dismissal can be interrupted and retargeted mid-flight, and
 * so the drag and the settle are the same animation rather than a gesture
 * followed by a separate transition.
 *
 * Two structural notes:
 * - The `Modal` **outlives** `visible` (`rendered`) so the exit spring is not
 *   cut off by an unmount — the same reasoning as `ui/snackbar.tsx`. The
 *   `withSpring` callback only hides on `finished`, which Reanimated reports as
 *   `false` when a newer animation replaces it, so reopening mid-exit is safe.
 * - Gesture Handler needs its own root **inside** the Modal: on Android a modal
 *   is a separate window, so the app-level `GestureHandlerRootView` in
 *   `app/_layout.tsx` does not cover it.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  presentation = "bottom",
}: SheetProps) {
  const { colors: c } = useTheme();
  const reduceMotion = useReducedMotion();
  const isBottom = presentation === "bottom";

  const [rendered, setRendered] = useState(visible);
  /** 0 = dismissed, 1 = resting. Drives opacity and (bottom) the slide. */
  const progress = useSharedValue(0);
  /** Live downward drag offset, in dp. */
  const drag = useSharedValue(0);
  /** Measured panel height — the slide distance, so it never over-travels. */
  const panelH = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // The `Modal` has to outlive `visible` so the exit spring is not cut off
      // by an unmount. That makes `rendered` a deliberate mount latch rather
      // than state derived from props, so latching it here is intended.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRendered(true);
      // Always open from rest, even if the last dismissal was a flick that left
      // the panel part-way down. Safe to snap: the panel is off-screen here.
      drag.value = 0;
      progress.value = withSpring(1, springs.sheet);
      return;
    }
    progress.value = withSpring(0, springs.sheet, (finished) => {
      if (finished) {
        runOnJS(setRendered)(false);
      }
    });
  }, [visible, progress, drag]);

  const onPanelLayout = useCallback(
    (e: LayoutChangeEvent) => {
      // eslint-disable-next-line react-hooks/immutability
      panelH.value = e.nativeEvent.layout.height;
    },
    [panelH],
  );

  const pan = Gesture.Pan()
    // Reduce Motion: no travel at all, so there is nothing to drag.
    .enabled(isBottom && !reduceMotion)
    // Claim only clearly vertical drags; horizontal stays with the content.
    .activeOffsetY([-8, 8])
    .failOffsetX([-12, 12])
    .onStart(() => {
      // eslint-disable-next-line react-hooks/immutability
      drag.value = 0;
    })
    .onUpdate((e) => {
      // Dragging down reveals the dismissal; dragging up has nothing to show,
      // so it meets friction rather than an invisible wall.
      // eslint-disable-next-line react-hooks/immutability
      drag.value =
        e.translationY > 0
          ? e.translationY
          : e.translationY * UPWARD_RESISTANCE;
    })
    .onEnd((e) => {
      const projected = drag.value + e.velocityY * 0.1;
      const dismiss =
        projected > panelH.value * DISMISS_RATIO ||
        e.velocityY > DISMISS_VELOCITY;
      if (dismiss) {
        // Leave `drag` where it is: the exit spring already travels a full
        // panel height, and snapping the offset back first would bounce the
        // panel up into view before it left.
        runOnJS(onClose)();
        return;
      }
      // eslint-disable-next-line react-hooks/immutability
      drag.value = withSpring(0, springs.ui);
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const panelStyle = useAnimatedStyle(() => {
    if (!isBottom) {
      // A modal is centred, so it has no slide to make — it fades and settles a
      // hair smaller. Never from `scale(0)`: nothing appears from nothing.
      return {
        opacity: progress.value,
        transform: [{ scale: reduceMotion ? 1 : 0.96 + 0.04 * progress.value }],
      };
    }
    return {
      opacity: progress.value,
      transform: [
        {
          translateY:
            (reduceMotion ? 0 : (1 - progress.value) * panelH.value) +
            drag.value,
        },
      ],
    };
  });

  return (
    <Modal
      visible={rendered}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView
        style={[styles.overlay, !isBottom && styles.overlayCentered]}
      >
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityLabel="close sheet"
          />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            onLayout={onPanelLayout}
            style={[
              isBottom ? styles.bottomSheet : styles.modalSheet,
              {
                backgroundColor: c.surface,
                borderColor: c.border,
                shadowColor: c.shadowColor,
                shadowOpacity: c.shadowOpacity,
              },
              panelStyle,
            ]}
          >
            <View
              style={[styles.handle, { backgroundColor: c.borderStrong }]}
            />
            {title ? (
              <Text style={[styles.title, { color: c.ink }]}>{title}</Text>
            ) : null}
            {children}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlayCentered: {
    justifyContent: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  bottomSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    maxHeight: "82%",
  },
  modalSheet: {
    borderRadius: radius.xl,
    borderWidth: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    margin: spacing.xl,
    padding: spacing.lg,
    maxHeight: "82%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: spacing.lg,
  },
});
