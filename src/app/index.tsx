import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useSettings } from '@/storage/settings';
import { fontRoles, spacing, typeScale } from '@/theme';

export default function IndexScreen() {
  const { t, language } = useT();
  const { colors: c } = useTheme();
  const fonts = fontRoles[language];
  const { defaultCanvasIndex } = useSettings();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.paper }]}>
      <View style={styles.center}>
        <Text style={[styles.wordmark, { fontFamily: fonts.display, color: c.ink }]}>مداد</Text>
        <Text style={[styles.latin, { fontFamily: 'Geist', color: c.muted }]}>midad</Text>
        <Text style={[styles.tagline, { fontFamily: fonts.ui, color: c.inkSoft }]}>{t.tagline}</Text>
        <Text style={[styles.meta, { fontFamily: fonts.ui, color: c.faint }]}>
          {t.editor.canvasSize} · #{defaultCanvasIndex + 1}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
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
  },
  latin: {
    fontSize: typeScale.subheading.size,
    letterSpacing: 0.18,
    textTransform: 'uppercase',
    marginTop: -spacing.lg,
  },
  tagline: {
    fontSize: typeScale.body.size,
    lineHeight: typeScale.body.lineHeight,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  meta: {
    fontSize: typeScale.caption.size,
    marginTop: spacing.sm,
  },
});