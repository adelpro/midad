import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { radius, type MidadPalette } from '@/theme';

export interface CardProps extends PropsWithChildren {
  onPress?: () => void;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Minimalist card: 1px hairline border, crisp 8–12px radius, no heavy shadow. */
export function Card({ children, onPress, elevated, style, testID }: CardProps) {
  const { colors: c } = useTheme();
  const baseStyle = [styles.base, { backgroundColor: c.surface, borderColor: c.border }, elevated && shadowStyle(c), style];
  const body = (
    <View testID={testID} style={baseStyle} accessibilityRole={onPress ? 'button' : undefined}>
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {body}
      </Pressable>
    );
  }
  return body;
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
  pressed: {
    opacity: 0.7,
  },
});