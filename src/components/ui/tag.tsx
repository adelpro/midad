import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, tagType } from '@/theme';

export type TagTone = 'neutral' | 'red' | 'blue' | 'green' | 'yellow' | 'accent';

const tones: Record<TagTone, { bg: string; text: string }> = {
  neutral: { bg: colors.surfaceAlt, text: colors.muted },
  red: colors.paleRed,
  blue: colors.paleBlue,
  green: colors.paleGreen,
  yellow: colors.paleYellow,
  accent: { bg: colors.accentSoft, text: colors.accentText },
};

export interface TagProps extends PropsWithChildren {
  tone?: TagTone;
}

/** Pill tag with micro uppercase wide-tracked type (per minimalist-ui). */
export function Tag({ children, tone = 'neutral' }: TagProps) {
  const c = tones[tone];
  return (
    <View style={[styles.base, { backgroundColor: c.bg }]}>
      <Text style={[styles.label, { color: c.text }]}>{children}</Text>
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