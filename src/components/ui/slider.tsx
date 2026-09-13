import { useCallback, useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/use-theme";
import { radius, springs } from "@/theme";

/** Thumb diameter (dp) — the visible affordance, and the thing you grab. */
const THUMB_SIZE = 22;
/** Rail thickness (dp). A hairline: the thumb carries the weight, not the rail. */
const TRACK_HEIGHT = 4;
/** Total height (dp) — a comfortable touch target around a 4dp rail. */
const HIT_HEIGHT = 44;
/** Vertical inset that centres a track element in the row. */
const RAIL_TOP = (HIT_HEIGHT - TRACK_HEIGHT) / 2;
const THUMB_TOP = (HIT_HEIGHT - THUMB_SIZE) / 2;

export type SliderScale = "linear" | "log";

export interface SliderProps {
  value: number;
  min: number;
  /** Must be > 0 when `scale` is `"log"` — a geometric range needs a positive floor. */
  max: number;
  /** Value quantisation. Default `1`. */
  step?: number;
  /**
   * `"log"` maps equal travel to equal *relative* change, so doubling a small
   * size costs the same drag as doubling a large one. That is the honest feel
   * for type sizes; `"linear"` crowds the small end of a wide range.
   */
  scale?: SliderScale;
  /** Fires continuously while dragging, with the snapped value. */
  onChange?: (value: number) => void;
  /** Fires once as a drag activates, before the first `onChange`. */
  onSlidingStart?: () => void;
  /** Fires once as the interaction ends, with the final snapped value. */
  onSlidingComplete?: (value: number) => void;
  /** Mirror the travel direction so the track starts on the right. */
  rtl?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Track position (0–1) → snapped value.
 *
 * A worklet so the gesture handlers and the JS thread share one definition
 * rather than drifting apart.
 */
function positionToValue(
  position: number,
  min: number,
  max: number,
  scale: SliderScale,
  step: number,
): number {
  "worklet";
  const raw =
    scale === "log"
      ? min * Math.pow(max / min, position)
      : min + position * (max - min);
  // Snap first, then clamp: clamping first can leave an off-grid value at the ends.
  const snapped = Math.round(raw / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

/** Value → track position (0–1). The pre-snap inverse of `positionToValue`. */
function valueToPosition(
  value: number,
  min: number,
  max: number,
  scale: SliderScale,
): number {
  "worklet";
  const t =
    scale === "log"
      ? Math.log(value / min) / Math.log(max / min)
      : (value - min) / (max - min);
  return Math.min(1, Math.max(0, t));
}

/** Pointer x (relative to the track's start edge) → position (0–1). */
function xToPosition(x: number, width: number, rtl: boolean): number {
  "worklet";
  if (width <= 0) {
    return 0;
  }
  const t = x / width;
  return Math.min(1, Math.max(0, rtl ? 1 - t : t));
}

/**
 * Horizontal value slider.
 *
 * The thumb is driven by a **shared value on the UI thread**, so it tracks the
 * finger at frame rate regardless of what the JS thread is doing; the gesture
 * only hops to JS to report the value. That split is the whole point of this
 * component — routing every frame through React state would drop the thumb to
 * whatever rate the surrounding screen can re-render at.
 *
 * RTL is handled explicitly rather than left to auto-mirroring: the rail, fill
 * and thumb are absolutely positioned, so flexbox never sees a direction to
 * mirror. `rtl` flips both the grab maths and the anchoring together.
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  scale = "linear",
  onChange,
  onSlidingStart,
  onSlidingComplete,
  rtl = false,
  disabled = false,
  accessibilityLabel,
  style,
}: SliderProps) {
  const { colors: c } = useTheme();
  const reduceMotion = useReducedMotion();
  /** Measured travel width (dp) — the distance the thumb's centre spans. */
  const [trackWidth, setTrackWidth] = useState(0);
  /**
   * React state, not a shared value, so the sync effect below never has to read
   * `.value` and the thumb is never fought by a prop update mid-drag.
   */
  const [dragging, setDragging] = useState(false);

  /** Thumb position, 0–1. Lives on the UI thread. */
  const position = useSharedValue(0);

  const emitChange = useCallback(
    (next: number) => onChange?.(next),
    [onChange],
  );
  const emitStart = useCallback(() => onSlidingStart?.(), [onSlidingStart]);
  const emitComplete = useCallback(
    (next: number) => onSlidingComplete?.(next),
    [onSlidingComplete],
  );

  /** Snap a raw position and report it — the JS half of a drag update. */
  const report = useCallback(
    (rawPosition: number) => {
      emitChange(positionToValue(rawPosition, min, max, scale, step));
    },
    [emitChange, min, max, scale, step],
  );

  /** Report the settled value — the JS half of a gesture ending. */
  const settle = useCallback(
    (rawPosition: number) => {
      emitComplete(positionToValue(rawPosition, min, max, scale, step));
    },
    [emitComplete, min, max, scale, step],
  );

  // Follow the prop whenever the value is not being driven by a finger. The
  // drag owns the thumb while `dragging` is true, so the parent's echo of
  // `onChange` cannot fight it.
  useEffect(() => {
    if (dragging) {
      return;
    }
    const target = valueToPosition(value, min, max, scale);
    position.value = reduceMotion ? target : withSpring(target, springs.ui);
  }, [value, min, max, scale, dragging, reduceMotion, position]);

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    // Claim horizontal drags. The surrounding sheet owns vertical ones and
    // already fails on horizontal movement, so the two never contend.
    .activeOffsetX([-4, 4])
    .onStart((e) => {
      const rawPosition = xToPosition(e.x, trackWidth, rtl);
      // eslint-disable-next-line react-hooks/immutability
      position.value = rawPosition;
      runOnJS(setDragging)(true);
      runOnJS(emitStart)();
      runOnJS(report)(rawPosition);
    })
    .onUpdate((e) => {
      const rawPosition = xToPosition(e.x, trackWidth, rtl);
      // eslint-disable-next-line react-hooks/immutability
      position.value = rawPosition;
      runOnJS(report)(rawPosition);
    })
    .onEnd((e) => {
      runOnJS(settle)(xToPosition(e.x, trackWidth, rtl));
    })
    // Also runs on cancellation, so the thumb always returns to following props.
    .onFinalize(() => {
      runOnJS(setDragging)(false);
    });

  // A tap is a deliberate jump, not a drag — same reporting, no drag state.
  const tap = Gesture.Tap()
    .enabled(!disabled)
    .onStart((e) => {
      const rawPosition = xToPosition(e.x, trackWidth, rtl);
      // eslint-disable-next-line react-hooks/immutability
      position.value = rawPosition;
      runOnJS(report)(rawPosition);
      runOnJS(settle)(rawPosition);
    });

  const gesture = Gesture.Race(pan, tap);

  const thumbStyle = useAnimatedStyle(
    () => ({
      transform: [
        {
          // Mirrored anchoring: in RTL the thumb starts at the right edge, so
          // its travel is negative. Without this the thumb would move opposite
          // to the finger.
          translateX:
            (rtl ? -1 : 1) * (position.value * trackWidth - THUMB_SIZE / 2),
        },
      ],
    }),
    [trackWidth, rtl],
  );

  const fillStyle = useAnimatedStyle(
    () => ({
      width: position.value * trackWidth,
    }),
    [trackWidth],
  );

  /** Screen-reader increments should be a useful jump, not one `step`. */
  const coarseStep = Math.max(step, Math.round((max - min) / 20));

  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const delta =
        event.nativeEvent.actionName === "increment" ? coarseStep : -coarseStep;
      const next = Math.min(max, Math.max(min, value + delta));
      emitChange(next);
      emitComplete(next);
    },
    [coarseStep, max, min, value, emitChange, emitComplete],
  );

  return (
    <View
      style={[
        styles.outer,
        disabled && styles.disabled,
        // Inset by half a thumb so the thumb never overhangs the row at either end.
        { paddingHorizontal: THUMB_SIZE / 2 },
        style,
      ]}
    >
      <GestureDetector gesture={gesture}>
        <View
          onLayout={onTrackLayout}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          // `aria-*` rather than `accessibilityValue`: React Native maps these
          // to the same native value, and react-native-web actually emits them.
          // `accessibilityValue` is dropped on web (verified in a browser), so
          // a screen reader there would announce a slider with no value at all.
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={Math.round(value)}
          accessibilityActions={[
            { name: "increment" },
            { name: "decrement" },
          ]}
          onAccessibilityAction={onAccessibilityAction}
          style={styles.track}
        >
          <View style={[styles.rail, { backgroundColor: c.borderStrong }]} />
          <Animated.View
            style={[
              styles.fill,
              rtl ? styles.anchorRight : styles.anchorLeft,
              { backgroundColor: c.accent },
              fillStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.thumb,
              rtl ? styles.anchorRight : styles.anchorLeft,
              { backgroundColor: c.surface, borderColor: c.accent },
              thumbStyle,
            ]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    height: HIT_HEIGHT,
    justifyContent: "center",
  },
  disabled: { opacity: 0.4 },
  track: {
    height: HIT_HEIGHT,
    justifyContent: "center",
  },
  rail: {
    position: "absolute",
    left: 0,
    right: 0,
    top: RAIL_TOP,
    height: TRACK_HEIGHT,
    borderRadius: radius.pill,
  },
  fill: {
    position: "absolute",
    top: RAIL_TOP,
    height: TRACK_HEIGHT,
    borderRadius: radius.pill,
  },
  thumb: {
    position: "absolute",
    top: THUMB_TOP,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2,
  },
  anchorLeft: { left: 0 },
  anchorRight: { right: 0 },
});
