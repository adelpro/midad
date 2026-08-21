import { forwardRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { motion, radius, spacing, type MidadPalette } from '@/theme';

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
}

function variantColors(variant: ButtonVariant, c: MidadPalette) {
  switch (variant) {
    case 'primary':
      return { bg: c.ink, text: c.onInk, pressed: c.inkSoft };
    case 'secondary':
      return { bg: c.surfaceAlt, text: c.ink, border: c.border, pressed: c.surfacePressed };
    case 'ghost':
      return { bg: 'transparent', text: c.inkSoft, pressed: c.surfacePressed };
    case 'danger':
      return { bg: c.danger, text: '#FFFFFF', pressed: c.dangerBg };
  }
}

const heights = { md: 44, lg: 52 };

export const Button = forwardRef<View, ButtonProps>(function Button(
  { onPress, label, variant = 'primary', disabled, loading, fullWidth, size = 'md', style, testID },
  ref,
) {
  const { colors: c } = useTheme();
  const vc = variantColors(variant, c);
  const dimmed = disabled || loading;
  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: dimmed }}
      disabled={dimmed}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          height: heights[size],
          backgroundColor: vc.bg,
          borderColor: vc.border,
          opacity: dimmed ? 0.5 : 1,
          transform: [{ scale: pressed && !dimmed ? 0.98 : 1 }],
        },
        fullWidth && styles.fullWidth,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={vc.text} />
      ) : (
        <Text style={[styles.label, { color: vc.text }]}>{label}</Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'solid',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.01,
  },
});