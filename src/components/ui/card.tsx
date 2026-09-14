import type { PropsWithChildren } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { usePressFeedback } from "@/hooks/use-press-feedback";
import { useTheme } from "@/hooks/use-theme";
import { radius, type MidadPalette } from "@/theme";

export interface CardProps extends PropsWithChildren {
  onPress?: () => void;
  onLongPress?: () => void;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
  /**
   * Custom screen-reader actions. The escape hatch that keeps gesture-only
   * affordances reachable without touch — e.g. swipe actions on a row.
   */
  accessibilityActions?: AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
}

/**
 * Minimalist card: 1px hairline border, crisp 8–12px radius, no heavy shadow.
 *
 * Accessibility props land on whichever node actually takes focus. When the
 * card is interactive that is the `Pressable` (which is implicitly
 * `accessible`), not the inner `View` — a role on a non-accessible `View` is
 * inert on iOS and leaves the control unlabelled.
 */
export function Card({
  children,
  onPress,
  onLongPress,
  elevated,
  style,
  testID,
  ...a11y
}: CardProps) {
  const { colors: c } = useTheme();
  const press = usePressFeedback();
  // The scale rides on the inner surface rather than a new wrapper: the card is
  // already a transparent Pressable around one styled View, and inserting a
  // level above it would collapse the grid tile's `flex: 1` (see ProjectRow's
  // note on the auto-height parent trap).
  const animStyle = useAnimatedStyle(() => ({
    opacity: press.pressed.value ? 0.7 : 1,
    transform: [{ scale: press.scale.value }],
  }));
  const baseStyle = [
    styles.base,
    { backgroundColor: c.surface, borderColor: c.border },
    elevated && shadowStyle(c),
    style,
  ];
  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        {...a11y}
      >
        <Animated.View testID={testID} style={[baseStyle, animStyle]}>
          {children}
        </Animated.View>
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={baseStyle} {...a11y}>
      {children}
    </View>
  );
}

function shadowStyle(c: MidadPalette) {
  return {
    shadowColor: c.shadowColor,
    shadowOpacity: c.shadowOpacity,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  };
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: radius.lg,
  },
});
