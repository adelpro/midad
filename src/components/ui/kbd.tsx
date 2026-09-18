import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { radius, spacing } from '@/theme';

/** Keystroke micro-UI: mono font, hairline border, 4px radius. */
export function Kbd({ children }: PropsWithChildren) {
  const { colors: c } = useTheme();
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: c.surfaceAlt, borderColor: c.border },
      ]}
    >
      <Text style={[styles.label, { color: c.inkSoft }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderBottomWidth: 2,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm - 2,
    paddingVertical: 2,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 14,
  },
});
