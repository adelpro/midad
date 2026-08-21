import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

/** Keystroke micro-UI: mono font, hairline border, 4px radius. */
export function Kbd({ children }: PropsWithChildren) {
  return (
    <View style={styles.base}>
      <Text style={styles.label}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm - 2,
    paddingVertical: 2,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.inkSoft,
    lineHeight: 14,
  },
});