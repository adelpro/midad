import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { radius } from '@/theme';
import { Tooltip } from './tooltip';

export interface IconButtonProps extends PropsWithChildren {
  onPress?: () => void;
  disabled?: boolean;
  /** surface-tone background */
  variant?: 'ghost' | 'surface' | 'ink';
  size?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Visible hint text on web hover and native long-press. */
  hint?: string;
  onLongPress?: () => void;
}

/** Square icon button for toolbar/rail actions. */
export function IconButton({
  onPress,
  disabled,
  variant = 'ghost',
  size = 40,
  accessibilityLabel,
  accessibilityHint,
  hint,
  onLongPress,
  children,
}: IconButtonProps) {
  const { colors: c } = useTheme();
  const [hintVisible, setHintVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bg = variant === 'ink' ? c.ink : variant === 'surface' ? c.surface : 'transparent';
  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);
  const show = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setHintVisible(true);
  };
  const hide = () => {
    hideTimer.current = setTimeout(() => setHintVisible(false), 1200);
  };
  return (
    <Tooltip label={hint ?? accessibilityLabel ?? ''} visible={!!hint && hintVisible}>
      <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onLongPress={() => {
        show();
        onLongPress?.();
      }}
      delayLongPress={350}
      onHoverIn={show}
      onHoverOut={hide}
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
    </Tooltip>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});