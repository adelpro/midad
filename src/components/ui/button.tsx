import { forwardRef } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useAnimatedStyle } from 'react-native-reanimated';

import { usePressFeedback } from '@/hooks/use-press-feedback';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { fontRoles, radius, spacing, type MidadPalette } from '@/theme';

import { FittedLabel } from './fitted-label';
import { AnimatedPressable } from './pressable';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  onPress?: () => void;
  label: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  size?: 'md' | 'lg';
  style?: ViewStyle;
  testID?: string;
  /** Overrides `label` as the accessibility name. */
  accessibilityLabel?: string;
  /** Extra guidance for screen readers. Never shown visually. */
  accessibilityHint?: string;
  /** Marks the button as a chosen option in the accessibility tree. */
  selected?: boolean;
  /**
   * Shrink the label to fit rather than wrap or ellipsize. For fixed-width
   * buttons whose label is longer than a phone-width share of the row.
   */
  labelFit?: boolean;
  /**
   * Type override for the label, merged last. Dense controls shrink the type so
   * every option fits whole — `labelFit` alone cannot do it on the web, where
   * react-native-web ignores `adjustsFontSizeToFit` and ellipsizes instead.
   */
  labelStyle?: StyleProp<TextStyle>;
}

function variantColors(variant: ButtonVariant, c: MidadPalette) {
  switch (variant) {
    case 'primary':
      return { bg: c.ink, text: c.onInk, pressed: c.inkSoft };
    case 'secondary':
      return {
        bg: c.surfaceAlt,
        text: c.ink,
        border: c.border,
        pressed: c.surfacePressed,
      };
    case 'ghost':
      return { bg: 'transparent', text: c.inkSoft, pressed: c.surfacePressed };
    case 'danger':
      // No `pressed` fill: `dangerBg` is a pale tint, so using it would leave
      // the white label unreadable. Danger keeps its oxblood fill and signals
      // the press through the scale alone.
      return { bg: c.danger, text: '#FFFFFF' };
  }
}

const heights = { md: 44, lg: 52 };

export const Button = forwardRef<View, ButtonProps>(function Button(
  {
    onPress,
    label,
    variant = 'primary',
    disabled,
    loading,
    fullWidth,
    size = 'md',
    style,
    testID,
    accessibilityLabel,
    accessibilityHint,
    selected,
    labelFit,
    labelStyle: labelStyleOverride,
  },
  ref,
) {
  const { colors: c } = useTheme();
  const { language } = useT();
  const fonts = fontRoles[language];
  const vc = variantColors(variant, c);
  const dimmed = disabled || loading;
  const press = usePressFeedback();
  const labelStyle: StyleProp<TextStyle> = [
    styles.label,
    {
      color: vc.text,
      fontFamily: fonts.uiBold,
      // Tracking breaks Arabic cursive joining — Latin-only.
      letterSpacing: language === 'ar' ? 0 : 0.01,
    },
    labelStyleOverride,
  ];

  const restBg = vc.bg;
  const activeBg = vc.pressed ?? vc.bg;
  // Press feedback is continuous from touch-DOWN to release (DESIGN.md §6):
  // the fill flips the instant the pointer lands, the scale springs back.
  const animStyle = useAnimatedStyle(
    () => ({
      transform: [{ scale: press.scale.value }],
      backgroundColor: press.pressed.value ? activeBg : restBg,
    }),
    [activeBg, restBg],
  );

  return (
    <AnimatedPressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: dimmed, selected }}
      disabled={dimmed}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        styles.base,
        {
          height: heights[size],
          // Only `secondary` draws a hairline. Filled and ghost variants must
          // not inherit a platform-default border colour — it shows as a dark
          // ring around the light `ink` fill in dark mode.
          borderColor: vc.border ?? 'transparent',
          opacity: dimmed ? 0.5 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
        animStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={vc.text} />
      ) : labelFit ? (
        <FittedLabel label={label} style={labelStyle} />
      ) : (
        <Text style={labelStyle}>{label}</Text>
      )}
    </AnimatedPressable>
  );
});

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    // DESIGN.md §4 — buttons are radius 8 (`radius.lg`), cards are 12.
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'solid',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  label: {
    fontSize: 15,
  },
});
