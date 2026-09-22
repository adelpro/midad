import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { rowStyle } from '@/i18n/rtl';
import {
  elevationStyle,
  fontRoles,
  layout,
  motion,
  radius,
  shadows,
  spacing,
  springs,
  typeScale,
} from '@/theme';

import { countdownDashOffset, secondsFromProgress } from './snackbar-timing';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Countdown ring geometry, in pt. */
const RING_SIZE = 22;
const RING_STROKE = 2.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export interface SnackbarProps {
  visible: boolean;
  message: string;
  /** Single action, e.g. "Undo". Omit for a plain message. */
  actionLabel?: string;
  onAction?: () => void;
  /** Distance from the bottom of the containing screen. */
  bottomOffset?: number;
  /**
   * Window length for a visible countdown. When set, a ring drains over this
   * time with the whole seconds left inside it. Omit for a plain message bar.
   */
  durationMs?: number;
  /**
   * Changes every time the window restarts (e.g. the pending item's id), so a
   * second delete re-arms the ring instead of inheriting the first one's arc.
   */
  resetKey?: string | number;
}

/**
 * Floating action bar for reversible operations (DESIGN.md §4 "Feedback").
 *
 * Deliberately not a `Modal`: it must not trap focus or block the tab bar, and
 * it lives inside the screen so it can float above a list that may unmount
 * underneath it. The bar stays mounted and animates to zero opacity, which
 * keeps the exit animation from being cut off by an unmount — `pointerEvents`
 * is what actually stops it swallowing touches while hidden.
 *
 * Text sits on `surface` + hairline rather than an ink fill because the accent
 * "Undo" label needs a token that clears AA in *both* palettes: `accentText` is
 * dark saffron on white (5.2:1) and light saffron on charcoal (8.9:1), whereas
 * `accent` on an ink fill drops to ~2:1 in dark mode.
 */
export function Snackbar({
  visible,
  message,
  actionLabel,
  onAction,
  bottomOffset = 0,
  durationMs,
  resetKey,
}: SnackbarProps) {
  const { colors: c } = useTheme();
  const { language, isRTL } = useT();
  const fonts = fontRoles[language];
  const reduceMotion = useReducedMotion();

  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = withTiming(visible ? 1 : 0, { duration: motion.fast });
      return;
    }
    // Asymmetric on purpose: the bar arriving settles (`sheet`), but leaving is
    // a system response — the undo window closing or the user dismissing it —
    // so it snaps out without a settle (`exit`).
    progress.value = visible
      ? withSpring(1, springs.sheet)
      : withSpring(0, springs.exit);
  }, [visible, reduceMotion, progress]);

  // Countdown runs 1 → 0 over the same window the real commit timer uses, so the
  // ring and the delete stay in step. Linear on purpose: this is a clock, not an
  // interactive element, and DESIGN.md's springs-only rule covers things a user
  // touches. `resetKey` re-arms it for a second delete.
  const countdown = useSharedValue(1);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!visible || !durationMs) {
      // The reaction below mirrors this back to 0 for the label.
      countdown.value = 1;
      return;
    }
    countdown.value = 1;
    countdown.value = withTiming(0, {
      duration: durationMs,
      easing: Easing.linear,
    });
  }, [visible, resetKey, durationMs, countdown]);

  // Only cross the JS boundary when the whole-second label actually changes,
  // never per frame.
  useAnimatedReaction(
    () =>
      visible && durationMs
        ? secondsFromProgress(countdown.value, durationMs)
        : 0,
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setSeconds)(current);
      }
    },
    [visible, durationMs],
  );

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: countdownDashOffset(RING_CIRCUMFERENCE, countdown.value),
  }));

  // `accessibilityLiveRegion` covers Android; iOS needs an explicit
  // announcement, and doing both would double-speak.
  useEffect(() => {
    if (visible && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [visible, message]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    // Reduce Motion gets the cross-fade only — no travel.
    transform: reduceMotion
      ? []
      : [{ translateY: (1 - progress.value) * spacing.sm }],
  }));

  return (
    <Animated.View
      style={[
        styles.anchor,
        { bottom: bottomOffset },
        animStyle,
        { pointerEvents: visible ? 'box-none' : 'none' },
      ]}
      accessibilityLiveRegion="polite"
    >
      <View
        style={[
          styles.bar,
          rowStyle(isRTL),
          { backgroundColor: c.surface, borderColor: c.border },
          elevationStyle(c, shadows.float),
        ]}
      >
        {durationMs ? (
          // Decorative: the seconds duplicate the window the live region already
          // announces, so the whole ring stays out of the a11y tree.
          <View
            style={styles.ringWrap}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={c.border}
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <AnimatedCircle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={c.accentText}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={RING_CIRCUMFERENCE}
                animatedProps={ringProps}
              />
            </Svg>
            <Text
              style={[styles.seconds, { color: c.muted, fontFamily: fonts.ui }]}
            >
              {seconds}
            </Text>
          </View>
        ) : null}
        <Text
          numberOfLines={2}
          style={[styles.message, { color: c.ink, fontFamily: fonts.ui }]}
        >
          {message}
        </Text>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            hitSlop={10}
            style={styles.action}
          >
            <Text
              style={[
                styles.actionLabel,
                { color: c.accentText, fontFamily: fonts.ui },
              ]}
            >
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    zIndex: 20,
  },
  bar: {
    width: '100%',
    maxWidth: layout.maxContent,
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  message: {
    flex: 1,
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seconds: {
    position: 'absolute',
    fontSize: typeScale.micro.size,
    fontVariant: ['tabular-nums'],
  },
  action: {
    // 44pt minimum target via hit-slop rather than padding, so the bar stays thin.
    minHeight: 24,
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: typeScale.small.size,
    fontWeight: '600',
  },
});
