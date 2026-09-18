import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { spacing } from '@/theme';

/** 1px hairline divider. */
export function Divider({ inset = 0 }: { inset?: number }) {
  const { colors: c } = useTheme();
  return (
    <View
      style={[
        styles.line,
        { backgroundColor: c.border, marginHorizontal: inset },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  line: {
    height: 1,
    marginVertical: spacing.xs,
  },
});
