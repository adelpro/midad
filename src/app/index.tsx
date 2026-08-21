import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { useSettings } from '@/storage/settings';
import { colors, fontRoles, spacing, typeScale } from '@/theme';

export default function IndexScreen() {
  const { t, language } = useT();
  const fonts = fontRoles[language];
  const { defaultCanvasIndex } = useSettings();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Text style={[styles.wordmark, { fontFamily: fonts.display }]}>مداد</Text>
        <Text style={[styles.latin, { fontFamily: 'Geist' }]}>midad</Text>
        <Text style={[styles.tagline, { fontFamily: fonts.ui }]}>{t.tagline}</Text>
        <Text style={[styles.meta, { fontFamily: fonts.ui }]}>
          {t.editor.canvasSize} · #{defaultCanvasIndex + 1}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  wordmark: {
    fontSize: 96,
    lineHeight: 116,
    color: colors.ink,
  },
  latin: {
    fontSize: typeScale.subheading.size,
    letterSpacing: 0.18,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: -spacing.lg,
  },
  tagline: {
    fontSize: typeScale.body.size,
    lineHeight: typeScale.body.lineHeight,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  meta: {
    fontSize: typeScale.caption.size,
    color: colors.faint,
    marginTop: spacing.sm,
  },
});