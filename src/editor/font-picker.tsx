import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, DirectionIcon } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import {
  familyForVariant,
  fontRoles,
  radius,
  spacing,
  typeScale,
  variantFor,
} from '@/theme';

export interface FontFieldProps {
  /** The current `fontKey`. */
  value: string;
  onPress: () => void;
}

/**
 * A single Font row for the Text sheet. Shows the current face set in that face
 * and opens the full-height picker; the catalogue itself lives in
 * `FontPickerSheet` so it never crowds this sheet.
 */
export function FontField({ value, onPress }: FontFieldProps) {
  const { colors: c } = useTheme();
  const { t, language, isRTL } = useT();
  const uiFont = fontRoles[language].ui;
  const family = familyForVariant(value);
  const variant = variantFor(value);
  const name = family
    ? `${language === 'ar' ? family.labelAr : family.labelEn} · ${
        language === 'ar' ? variant?.labelAr : variant?.labelEn
      }`
    : value;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: c.muted, fontFamily: uiFont }]}>
        {t.editor.fontFamily}
      </Text>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={`${t.editor.chooseFont}: ${name}`}
        onPress={onPress}
        style={[
          styles.field,
          { borderColor: c.border, backgroundColor: c.surfaceAlt },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.specimen, { color: c.ink, fontFamily: value }]}
        >
          بسم الله
        </Text>
        <View style={styles.right}>
          <Text style={[styles.name, { color: c.muted, fontFamily: uiFont }]}>
            {name}
          </Text>
          {/* RTL-aware chevron — points the way the reading direction expects. */}
          <DirectionIcon isRTL={isRTL} size={18} color={c.muted} />
        </View>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: {
    fontSize: typeScale.caption.size,
    lineHeight: typeScale.caption.lineHeight,
  },
  field: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  specimen: { fontSize: 22, flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { fontSize: typeScale.caption.size },
});
