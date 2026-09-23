import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { fontFamilies, fontRoles, radius, spacing, typeScale } from '@/theme';

export interface FontPickerProps {
  /** The current `fontKey` (a variant key). */
  value: string;
  /** Called with the chosen variant key. */
  onChange: (fontKey: string) => void;
}

/**
 * Family grid + inline variant chips (design: Layout A).
 *
 * The family tile renders its own name in its own face, so the letterform is
 * the specimen. Selecting a family reveals only the variants that family
 * ships; a single-variant family shows no chip row.
 */
export function FontPicker({ value, onChange }: FontPickerProps) {
  const { colors: c } = useTheme();
  const { t, language } = useT();
  const uiFont = fontRoles[language].ui;
  const activeFamily =
    fontFamilies.find((f) => f.variants.some((v) => v.key === value)) ??
    fontFamilies[0];

  const label = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <View style={styles.root}>
      <Text
        style={[styles.sectionLabel, { color: c.muted, fontFamily: uiFont }]}
      >
        {t.editor.fontFamily}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.grid}
      >
        {fontFamilies.map((family) => {
          const selected = family.key === activeFamily.key;
          return (
            <AnimatedPressable
              key={family.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label(
                family.labelAr,
                family.labelEn,
              )}, ${label(family.styleTagAr, family.styleTagEn)}`}
              onPress={() => onChange(family.defaultVariant)}
              style={[
                styles.tile,
                {
                  borderColor: selected ? c.ink : c.border,
                  backgroundColor: selected ? c.surfaceAlt : c.surface,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.tileSpecimen,
                  { color: c.ink, fontFamily: family.defaultVariant },
                ]}
              >
                {label(family.labelAr, family.labelEn)}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.tileTag, { color: c.muted, fontFamily: uiFont }]}
              >
                {label(family.styleTagAr, family.styleTagEn)}
              </Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>

      {activeFamily.variants.length > 1 && (
        <>
          <Text
            style={[styles.sectionLabel, { color: c.muted, fontFamily: uiFont }]}
          >
            {t.editor.variant}
          </Text>
          <View style={styles.chips}>
            {activeFamily.variants.map((variant) => {
              const selected = variant.key === value;
              return (
                <AnimatedPressable
                  key={variant.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={label(variant.labelAr, variant.labelEn)}
                  onPress={() => onChange(variant.key)}
                  style={[
                    styles.chip,
                    {
                      borderColor: selected ? c.ink : c.border,
                      backgroundColor: selected ? c.ink : c.surfaceAlt,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: selected ? c.onInk : c.ink,
                      fontFamily: uiFont,
                      fontSize: typeScale.caption.size,
                    }}
                  >
                    {label(variant.labelAr, variant.labelEn)}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  sectionLabel: {
    fontSize: typeScale.caption.size,
    lineHeight: typeScale.caption.lineHeight,
  },
  grid: { gap: spacing.sm, paddingVertical: spacing.xs },
  tile: {
    minWidth: 132,
    minHeight: 56,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    gap: 2,
  },
  tileSpecimen: { fontSize: 20 },
  tileTag: { fontSize: typeScale.caption.size },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
