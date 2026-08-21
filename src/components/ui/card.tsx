import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadows } from '@/theme';

export interface CardProps extends PropsWithChildren {
  onPress?: () => void;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Minimalist card: 1px hairline border, crisp 8–12px radius, no heavy shadow. */
export function Card({ children, onPress, elevated, style, testID }: CardProps) {
  const body = (
    <View
      testID={testID}
      style={[styles.base, elevated && shadows.card, style]}
      accessibilityRole={onPress ? 'button' : undefined}>
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

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  pressed: {
    opacity: 0.7,
  },
});