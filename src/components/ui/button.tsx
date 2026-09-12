import { forwardRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { useT } from "@/i18n";
import { fontRoles, radius, spacing, type MidadPalette } from "@/theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps {
  onPress?: () => void;
  label: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  size?: "md" | "lg";
  style?: ViewStyle;
  testID?: string;
  /** Overrides `label` as the accessibility name. */
  accessibilityLabel?: string;
  /** Marks the button as a chosen option in the accessibility tree. */
  selected?: boolean;
}

function variantColors(variant: ButtonVariant, c: MidadPalette) {
  switch (variant) {
    case "primary":
      return { bg: c.ink, text: c.onInk, pressed: c.inkSoft };
    case "secondary":
      return {
        bg: c.surfaceAlt,
        text: c.ink,
        border: c.border,
        pressed: c.surfacePressed,
      };
    case "ghost":
      return { bg: "transparent", text: c.inkSoft, pressed: c.surfacePressed };
    case "danger":
      // No `pressed` fill: `dangerBg` is a pale tint, so using it would leave
      // the white label unreadable. Danger keeps its oxblood fill and signals
      // the press through the scale alone.
      return { bg: c.danger, text: "#FFFFFF" };
  }
}

const heights = { md: 44, lg: 52 };

export const Button = forwardRef<View, ButtonProps>(function Button(
  {
    onPress,
    label,
    variant = "primary",
    disabled,
    loading,
    fullWidth,
    size = "md",
    style,
    testID,
    accessibilityLabel,
    selected,
  },
  ref,
) {
  const { colors: c } = useTheme();
  const { language } = useT();
  const fonts = fontRoles[language];
  const vc = variantColors(variant, c);
  const dimmed = disabled || loading;
  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: dimmed, selected }}
      disabled={dimmed}
      onPress={onPress}
      style={({ pressed }) => {
        // Press feedback is continuous from touch-DOWN to release (DESIGN.md §6).
        const active = pressed && !dimmed;
        return [
          styles.base,
          {
            height: heights[size],
            backgroundColor: active ? (vc.pressed ?? vc.bg) : vc.bg,
            // Only `secondary` draws a hairline. Filled and ghost variants must
            // not inherit a platform-default border colour — it shows as a dark
            // ring around the light `ink` fill in dark mode.
            borderColor: vc.border ?? "transparent",
            opacity: dimmed ? 0.5 : 1,
            transform: [{ scale: active ? 0.98 : 1 }],
          },
          fullWidth && styles.fullWidth,
          style,
        ];
      }}
    >
      {loading ? (
        <ActivityIndicator color={vc.text} />
      ) : (
        <Text
          style={[
            styles.label,
            {
              color: vc.text,
              fontFamily: fonts.uiBold,
              // Tracking breaks Arabic cursive joining — Latin-only.
              letterSpacing: language === "ar" ? 0 : 0.01,
            },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    // DESIGN.md §4 — buttons are radius 8 (`radius.lg`), cards are 12.
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "solid",
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  label: {
    fontSize: 15,
  },
});
