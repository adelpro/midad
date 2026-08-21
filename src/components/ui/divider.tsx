import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

/** 1px hairline divider. */
export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={[styles.line, { marginHorizontal: inset }]} />;
}

const styles = StyleSheet.create({
  line: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
});