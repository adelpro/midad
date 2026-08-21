import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors, radius } from '@/theme';

export interface IconButtonProps extends PropsWithChildren {
  onPress?: () => void;
  disabled?: boolean;
  /** surface-tone background */
  variant?: 'ghost' | 'surface' | 'ink';
  size?: number;
}

/** Square icon button for toolbar/rail actions. */
export function IconButton({
  onPress,
  disabled,
  variant = 'ghost',
  size = 40,
  children,
}: IconButtonProps) {
  const bg =
    variant === 'ink' ? colors.ink : variant === 'surface' ? colors.surface : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: radius.lg,
          backgroundColor: bg,
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
    borderColor: colors.border,
  },
});