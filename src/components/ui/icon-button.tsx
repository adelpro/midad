import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { StyleSheet } from "react-native";
import { useAnimatedStyle } from "react-native-reanimated";

import { usePressFeedback } from "@/hooks/use-press-feedback";
import { useTheme } from "@/hooks/use-theme";
import { isWeb } from "@/storage/platform";
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
  /**
   * The control's short name, for the long-press bubble.
   *
   * Native only: web renders no bubble at all (see `hintEnabled` below), so a
   * hint passed on web is inert.
   */
  hint?: string;
  /** Which side the hint bubble opens on. Defaults to above the button. */
  hintPlacement?: "above" | "below";
  /**
   * Long-press handler.
   *
   * Setting this suppresses the hint bubble for the gesture: a long-press can
   * only mean one thing, and the caller's handler is the more specific intent.
   */
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
  /**
   * Whether this platform shows a hint bubble at all.
   *
   * Web does not. A hover bubble is a pointer affordance the app can only spend
   * on desktop, and the same label is one tap away in learn mode — which is how
   * the editor names its icon-only chrome everywhere else. So on web the
   * tooltip is never fed and the pointer handlers that would open it are not
   * attached, rather than being attached and then ignored.
   */
  const hintEnabled = !isWeb && !!hint;
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
      visible={hintEnabled && hintVisible}
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
          // A caller's long-press owns the gesture outright. Opening the bubble
          // as well would give one press two meanings, and the bubble would
          // narrate the label while the callback changed something behind it.
          if (onLongPress) {
            onLongPress();
            return;
          }
          show();
        }}
        delayLongPress={350}
        onHoverIn={hintEnabled ? show : undefined}
        onHoverOut={hintEnabled ? hide : undefined}
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
