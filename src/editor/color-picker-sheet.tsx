import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { parseColor } from '@/theme/color';
import { inkSwatches } from '@/theme/content-palette';
import { fontRoles, radius, spacing, typeScale } from '@/theme';

export interface ColorPickerSheetProps {
  visible: boolean;
  /** The selection's current colour; the preview falls back to it. */
  value: string;
  /** Recently entered custom colours, most recent first. */
  recentColors: readonly string[];
  /**
   * Apply a colour to the selection. `custom` marks a typed entry, so the caller
   * knows to remember it.
   */
  onChange: (color: string, source: 'preset' | 'custom') => void;
  onClose: () => void;
}

/**
 * The Colors tool's picker: preset ink swatches, the recent customs, and a
 * custom hex/rgb field, with the selection itself as the live preview behind the
 * sheet. Presentational — it reads no editor store (`font-picker-sheet.tsx` is
 * the same shape), so the screen owns applying the colour and its undo session.
 */
export function ColorPickerSheet({
  visible,
  value,
  recentColors,
  onChange,
  onClose,
}: ColorPickerSheetProps) {
  const { colors: c } = useTheme();
  const { t, language, isRTL } = useT();
  const uiFont = fontRoles[language].ui;
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);

  // The sheet stays mounted while hidden, so a new visit starts clean.
  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft('');
      setInvalid(false);
    }
  }, [visible]);

  const parsed = useMemo(() => parseColor(draft), [draft]);
  const preview = parsed ?? value;

  const commit = () => {
    if (draft.trim() === '') {
      return;
    }
    const next = parseColor(draft);
    if (!next) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onChange(next, 'custom');
  };

  const renderSwatch = (col: string) => (
    <Pressable
      key={col}
      accessibilityRole="button"
      accessibilityLabel={col}
      accessibilityState={{ selected: value === col }}
      onPress={() => onChange(col, 'preset')}
      style={[
        styles.swatch,
        { backgroundColor: col, borderColor: c.border },
        value === col && { borderWidth: 3, borderColor: c.accentText },
      ]}
    />
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t.editor.pickColor}
      closeButton
      presentation={Platform.OS === 'web' ? 'modal' : 'bottom'}
    >
      <View style={styles.previewRow}>
        <View
          style={[
            styles.previewSwatch,
            { backgroundColor: preview, borderColor: c.border },
          ]}
        />
        <Text style={[styles.previewHex, { color: c.ink, fontFamily: uiFont }]}>
          {preview}
        </Text>
      </View>

      <Text style={[styles.label, { color: c.muted, fontFamily: uiFont }]}>
        {t.editor.colors}
      </Text>
      <View style={styles.grid}>{inkSwatches.map(renderSwatch)}</View>

      {recentColors.length > 0 && (
        <>
          <Text style={[styles.label, { color: c.muted, fontFamily: uiFont }]}>
            {t.editor.recentColors}
          </Text>
          <View style={styles.grid}>{recentColors.map(renderSwatch)}</View>
        </>
      )}

      <Text style={[styles.label, { color: c.muted, fontFamily: uiFont }]}>
        {t.editor.customColor}
      </Text>
      <View
        style={[
          styles.input,
          {
            backgroundColor: c.surfaceAlt,
            borderColor: invalid ? c.danger : c.border,
          },
        ]}
      >
        <TextInput
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            if (invalid) {
              setInvalid(false);
            }
          }}
          onBlur={commit}
          onSubmitEditing={commit}
          placeholder="#7A1F1F"
          placeholderTextColor={c.faint}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={t.editor.customColor}
          style={[
            styles.inputText,
            {
              color: c.ink,
              fontFamily: uiFont,
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            },
          ]}
        />
      </View>
      <Text
        style={[
          styles.hint,
          { color: invalid ? c.danger : c.muted, fontFamily: uiFont },
        ]}
      >
        {invalid ? t.editor.invalidColor : t.editor.colorFormatHint}
      </Text>

      <Button label={t.common.done} onPress={onClose} fullWidth />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  previewSwatch: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  previewHex: { fontSize: typeScale.body.size },
  label: {
    fontSize: typeScale.caption.size,
    lineHeight: typeScale.caption.lineHeight,
    marginBottom: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  swatch: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1 },
  input: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputText: { fontSize: typeScale.body.size, padding: 0 },
  hint: {
    fontSize: typeScale.caption.size,
    lineHeight: typeScale.caption.lineHeight,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
});
