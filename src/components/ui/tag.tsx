import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { radius, tagType, type MidadPalette } from '@/theme';

export type TagTone =
  'neutral' | 'red' | 'blue' | 'green' | 'yellow' | 'accent';

function tones(c: MidadPalette): Record<TagTone, { bg: string; text: string }> {
  return {
    neutral: { bg: c.surfaceAlt, text: c.muted },
    red: c.paleRed,
    blue: c.paleBlue,
    green: c.paleGreen,
    yellow: c.paleYellow,
    accent: { bg: c.accentSoft, text: c.accentText },
  };
}

export interface TagProps extends PropsWithChildren {
  tone?: TagTone;
}

/** Pill tag with micro uppercase wide-tracked type (per minimalist-ui). */
export function Tag({ children, tone = 'neutral' }: TagProps) {
  const { colors: c } = useTheme();
  const t = tones(c)[tone];
  return (
    <View style={[styles.base, { backgroundColor: t.bg }]}>
      <Text style={[styles.label, { color: t.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  label: {
    ...tagType,
    fontWeight: '500',
  },
});
