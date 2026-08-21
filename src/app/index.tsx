import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useSettings } from '@/storage/settings';
import { fontRoles, spacing, typeScale } from '@/theme';

const FEATURES = ['slide1', 'slide2', 'slide3'] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const { t, language, setLanguage } = useT();
  const { colors: c } = useTheme();
  const fonts = fontRoles[language];

  const start = () => router.replace('/(tabs)/gallery');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.paper }]}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={[styles.wordmark, { fontFamily: fonts.display, color: c.ink }]}>مداد</Text>
          <Text style={[styles.latin, { fontFamily: 'Geist', color: c.muted }]}>midad</Text>
          <Text style={[styles.tagline, { fontFamily: fonts.ui, color: c.inkSoft }]}>
            {t.tagline}
          </Text>
        </View>

        <View style={styles.features}>
          {FEATURES.map((key) => (
            <View key={key} style={[styles.featureRow, { borderColor: c.border }]}>
              <Text style={[styles.featureTitle, { fontFamily: fonts.ui, color: c.ink }]}>
                {t.onboarding[`${key}Title`]}
              </Text>
              <Text style={[styles.featureBody, { fontFamily: fonts.ui, color: c.muted }]}>
                {t.onboarding[`${key}Body`]}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.langLabel, { fontFamily: fonts.ui, color: c.muted }]}>
            {t.onboarding.chooseLanguage}
          </Text>
          <View style={styles.langRow}>
            <Button
              label={t.onboarding.arabic}
              variant={language === 'ar' ? 'primary' : 'secondary'}
              onPress={() => setLanguage('ar')}
              style={styles.langBtn}
            />
            <Button
              label={t.onboarding.english}
              variant={language === 'en' ? 'primary' : 'secondary'}
              onPress={() => setLanguage('en')}
              style={styles.langBtn}
            />
          </View>
          <Button label={t.common.start} onPress={start} fullWidth />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    marginTop: spacing.xxxl,
  },
  wordmark: {
    fontSize: 88,
    lineHeight: 104,
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
  features: {
    gap: spacing.lg,
  },
  featureRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  featureTitle: {
    fontSize: typeScale.subheading.size,
    lineHeight: typeScale.subheading.lineHeight,
    fontWeight: '600',
  },
  featureBody: {
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
  },
  footer: {
    gap: spacing.md,
  },
  langLabel: {
    fontSize: typeScale.caption.size,
  },
  langRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  langBtn: {
    flex: 1,
  },
});