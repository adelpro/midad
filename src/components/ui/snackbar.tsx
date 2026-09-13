import { useEffect } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/use-theme";
import { useT } from "@/i18n";
import { rowStyle } from "@/i18n/rtl";
import {
  fontRoles,
  layout,
  motion,
  radius,
  spacing,
  springs,
  typeScale,
} from "@/theme";

export interface SnackbarProps {
  visible: boolean;
  message: string;
  /** Single action, e.g. "Undo". Omit for a plain message. */
  actionLabel?: string;
  onAction?: () => void;
  /** Distance from the bottom of the containing screen. */
  bottomOffset?: number;
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

  // `accessibilityLiveRegion` covers Android; iOS needs an explicit
  // announcement, and doing both would double-speak.
  useEffect(() => {
    if (visible && Platform.OS === "ios") {
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
      style={[styles.anchor, { bottom: bottomOffset }, animStyle]}
      pointerEvents={visible ? "box-none" : "none"}
      accessibilityLiveRegion="polite"
    >
      <View
        style={[
          styles.bar,
          rowStyle(isRTL),
          {
            backgroundColor: c.surface,
            borderColor: c.border,
            shadowColor: c.shadowColor,
            shadowOpacity: c.shadowOpacity,
          },
        ]}
      >
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
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    zIndex: 20,
  },
  bar: {
    width: "100%",
    maxWidth: layout.maxContent,
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  message: {
    flex: 1,
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
  },
  action: {
    // 44pt minimum target via hit-slop rather than padding, so the bar stays thin.
    minHeight: 24,
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: typeScale.small.size,
    fontWeight: "600",
  },
});
