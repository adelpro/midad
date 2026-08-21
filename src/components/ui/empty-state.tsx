import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typeScale } from '@/theme';

export interface EmptyStateProps {
  /** Calligraphic display word (Arabic) rendered in Amiri. */
  glyph?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

/** Editorial empty state: an Amiri calligraphic glyph, then a calm message. */
export function EmptyState({ glyph, title, description, children }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {glyph ? <Text style={styles.glyph}>{glyph}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  glyph: {
    fontFamily: 'Amiri',
    fontSize: 72,
    color: colors.borderStrong,
    lineHeight: 88,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typeScale.heading.size,
    lineHeight: typeScale.heading.lineHeight,
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'center',
  },
  description: {
    fontSize: typeScale.body.size,
    lineHeight: typeScale.body.lineHeight,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 320,
  },
});