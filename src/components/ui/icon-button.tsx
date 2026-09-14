import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { StyleSheet } from "react-native";
import { useAnimatedStyle } from "react-native-reanimated";

import { usePressFeedback } from "@/hooks/use-press-feedback";
import { useTheme } from "@/hooks/use-theme";
import { radius } from "@/theme";

import { AnimatedPressable } from "./pressable";
import { Tooltip } from "./tooltip";

export interface IconButtonProps extends PropsWithChildren {
  onPress?: () => void;
  disabled?: boolean;
  /** surface-tone background */
  variant?: "ghost" | "surface" | "ink";
  size?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Visible hint text on web hover and native long-press. */
  hint?: string;
  /** Which side the hint bubble opens on. Defaults to above the button. */
  hintPlacement?: "above" | "below";
  onLongPress?: () => void;
}

/** Square icon button for toolbar/rail actions. */
export function IconButton({
  onPress,
  disabled,
  variant = "ghost",
  size = 40,
  accessibilityLabel,
  accessibilityHint,
  hint,
  hintPlacement,
  onLongPress,
  children,
}: IconButtonProps) {
  const { colors: c } = useTheme();
  const [hintVisible, setHintVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bg =
    variant === "ink"
      ? c.ink
      : variant === "surface"
        ? c.surface
        : "transparent";
  const press = usePressFeedback();
  const animStyle = useAnimatedStyle(
    () => ({
      opacity: disabled ? 0.4 : press.pressed.value ? 0.7 : 1,
      transform: [{ scale: press.scale.value }],
    }),
    [disabled],
  );
  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );
  const show = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setHintVisible(true);
  };
  const hide = () => {
    hideTimer.current = setTimeout(() => setHintVisible(false), 1200);
  };
  return (
    <Tooltip
      label={hint ?? accessibilityLabel ?? ""}
      visible={!!hint && hintVisible}
      placement={hintPlacement}
    >
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onLongPress={() => {
          show();
          onLongPress?.();
        }}
        delayLongPress={350}
        onHoverIn={show}
        onHoverOut={hide}
        style={[
          styles.base,
          {
            width: size,
            height: size,
            borderRadius: radius.lg,
            backgroundColor: bg,
            borderColor: c.border,
          },
          animStyle,
        ]}
      >
        {children}
      </AnimatedPressable>
    </Tooltip>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
