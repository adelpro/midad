import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { spacing, typeScale } from '@/theme';

export interface EmptyStateProps {
  /** Calligraphic display word (Arabic) rendered in Amiri. */
  glyph?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

/** Editorial empty state: an Amiri calligraphic glyph, then a calm message. */
export function EmptyState({
  glyph,
  title,
  description,
  children,
}: EmptyStateProps) {
  const { colors: c } = useTheme();
  return (
    <View style={styles.container}>
      {glyph ? (
        <Text style={[styles.glyph, { color: c.borderStrong }]}>{glyph}</Text>
      ) : null}
      <Text style={[styles.title, { color: c.ink }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: c.muted }]}>
          {description}
        </Text>
      ) : null}
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
    lineHeight: 88,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typeScale.heading.size,
    lineHeight: typeScale.heading.lineHeight,
    fontWeight: '600',
    textAlign: 'center',
  },
  description: {
    fontSize: typeScale.body.size,
    lineHeight: typeScale.body.lineHeight,
    textAlign: 'center',
    maxWidth: 320,
  },
});
