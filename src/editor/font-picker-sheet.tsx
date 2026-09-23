import { useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AnimatedPressable, Button, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import {
  familyForVariant,
  fontFamilies,
  fontRoles,
  radius,
  spacing,
  typeScale,
} from '@/theme';

/** A real phrase, so a row shows the face's letterforms rather than its name. */
const SPECIMEN = 'بسم الله';

export interface FontPickerSheetProps {
  visible: boolean;
  /** The current `fontKey`. */
  value: string;
  onChange: (fontKey: string) => void;
  onClose: () => void;
}

/**
 * Full-height font picker: a scrollable list of large specimens. The selected
 * family expands **inline** to reveal its variant chips, so the list never
 * reflows and single-variant families simply have no chip row.
 *
 * Native presents as a bottom sheet; web as a centred modal — the bottom sheet's
 * drag-to-dismiss is a touch affordance and can swallow the list's scroll.
 */
export function FontPickerSheet({
  visible,
  value,
  onChange,
  onClose,
}: FontPickerSheetProps) {
  const { colors: c } = useTheme();
  const { t, language, isRTL } = useT();
  const uiFont = fontRoles[language].ui;
  const [query, setQuery] = useState('');
  const activeKey = familyForVariant(value)?.key;

  const label = (ar: string, en: string) => (language === 'ar' ? ar : en);

  // Clear on close so reopening always shows the full catalogue, not the last
  // search term (the sheet stays mounted while hidden).
  const closeSheet = () => {
    setQuery('');
    onClose();
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fontFamilies;
    return fontFamilies.filter(
      (f) =>
        f.labelEn.toLowerCase().includes(q) ||
        f.labelAr.includes(q) ||
        f.styleTagEn.toLowerCase().includes(q) ||
        f.styleTagAr.includes(q),
    );
  }, [query]);

  return (
    <Sheet
      visible={visible}
      onClose={closeSheet}
      title={t.editor.fontFamily}
      closeButton
      presentation={Platform.OS === 'web' ? 'modal' : 'bottom'}
    >
      <View
        style={[
          styles.search,
          { backgroundColor: c.surfaceAlt, borderColor: c.border },
        ]}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.editor.searchFont}
          placeholderTextColor={c.muted}
          accessibilityLabel={t.editor.searchFont}
          style={[
            styles.searchInput,
            {
              color: c.ink,
              fontFamily: uiFont,
              writingDirection: isRTL ? 'rtl' : 'ltr',
              textAlign: isRTL ? 'right' : 'left',
            },
          ]}
        />
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listBody}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >
        {matches.map((family) => {
          const selected = family.key === activeKey;
          return (
            <View key={family.key}>
              <AnimatedPressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${label(
                  family.labelAr,
                  family.labelEn,
                )}, ${label(family.styleTagAr, family.styleTagEn)}`}
                onPress={() => onChange(family.defaultVariant)}
                style={[
                  styles.row,
                  {
                    borderColor: selected ? c.ink : c.border,
                    backgroundColor: selected ? c.surfaceAlt : c.surface,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.specimen,
                    { color: c.ink, fontFamily: family.defaultVariant },
                  ]}
                >
                  {SPECIMEN}
                </Text>
                <Text
                  style={[styles.meta, { color: c.muted, fontFamily: uiFont }]}
                >
                  {label(family.labelAr, family.labelEn)} ·{' '}
                  {label(family.styleTagAr, family.styleTagEn)}
                </Text>
              </AnimatedPressable>

              {selected && family.variants.length > 1 && (
                <View style={styles.chips}>
                  {family.variants.map((variant) => {
                    const on = variant.key === value;
                    return (
                      <AnimatedPressable
                        key={variant.key}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={label(
                          variant.labelAr,
                          variant.labelEn,
                        )}
                        onPress={() => onChange(variant.key)}
                        style={[
                          styles.chip,
                          {
                            borderColor: on ? c.ink : c.border,
                            backgroundColor: on ? c.ink : c.surfaceAlt,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: on ? c.onInk : c.ink,
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
              )}
            </View>
          );
        })}

        {matches.length === 0 && (
          <Text style={[styles.meta, { color: c.muted, fontFamily: uiFont }]}>
            {t.editor.noFontResults}
          </Text>
        )}
      </ScrollView>

      <Button label={t.common.done} onPress={closeSheet} fullWidth />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  search: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  searchInput: {
    fontSize: typeScale.body.size,
    padding: 0,
  },
  list: { flexShrink: 1 },
  listBody: { gap: spacing.sm, paddingBottom: spacing.md },
  row: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  specimen: { fontSize: 26 },
  meta: {
    fontSize: typeScale.caption.size,
    lineHeight: typeScale.caption.lineHeight,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
