import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { radius } from '@/theme';

export interface IconButtonProps extends PropsWithChildren {
  onPress?: () => void;
  disabled?: boolean;
  /** surface-tone background */
  variant?: 'ghost' | 'surface' | 'ink';
  size?: number;
  accessibilityLabel?: string;
}

/** Square icon button for toolbar/rail actions. */
export function IconButton({
  onPress,
  disabled,
  variant = 'ghost',
  size = 40,
  accessibilityLabel,
  children,
}: IconButtonProps) {
  const { colors: c } = useTheme();
  const bg = variant === 'ink' ? c.ink : variant === 'surface' ? c.surface : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: radius.lg,
          backgroundColor: bg,
          borderColor: c.border,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
      ]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});