import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LanguagePicker, OnboardingArt, StepDots, StepPager, type OnboardingArtVariant } from '@/components/onboarding';
import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { fontRoles, spacing, typeScale } from '@/theme';

const STEPS: { art: OnboardingArtVariant; titleKey: 'slide1Title' | 'slide2Title' | 'slide3Title'; bodyKey: 'slide1Body' | 'slide2Body' | 'slide3Body' }[] = [
  { art: 'craft', titleKey: 'slide1Title', bodyKey: 'slide1Body' },
  { art: 'fonts', titleKey: 'slide2Title', bodyKey: 'slide2Body' },
  { art: 'share', titleKey: 'slide3Title', bodyKey: 'slide3Body' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { t, language } = useT();
  const { colors: c } = useTheme();
  const fonts = fontRoles[language];

  const [index, setIndex] = useState(0);

  const goToGallery = useCallback(() => router.replace('/(tabs)/gallery'), [router]);

  const renderStep = useCallback(
    (stepIndex: number) => {
      const step = STEPS[stepIndex];
      return (
        <View style={styles.step}>
          <OnboardingArt variant={step.art} />
          <Text style={[styles.stepTitle, { fontFamily: fonts.display, color: c.ink }]}>
            {t.onboarding[step.titleKey]}
          </Text>
          <Text style={[styles.stepBody, { fontFamily: fonts.ui, color: c.muted }]}>
            {t.onboarding[step.bodyKey]}
          </Text>
        </View>
      );
    },
    [t, fonts, c],
  );

  const isLast = index === STEPS.length - 1;
  const next = () => {
    if (isLast) {
      goToGallery();
    } else {
      setIndex(index + 1);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.paper }]}>
      {/* top bar: wordmark + skip */}
      <View style={styles.topBar}>
        <Text style={[styles.wordmark, { fontFamily: fonts.display, color: c.ink }]}>مداد</Text>
        <Text onPress={goToGallery} style={[styles.skip, { fontFamily: fonts.ui, color: c.muted }]}>
          {t.onboarding.skip}
        </Text>
      </View>

      <StepPager
        count={STEPS.length}
        index={index}
        onIndexChange={setIndex}
        renderStep={renderStep}
        isRTL={language === 'ar'}
      />

      {/* footer: dots + language + CTA */}
      <View style={styles.footer}>
        <StepDots count={STEPS.length} index={index} />

        <View style={styles.langBox}>
          <Text style={[styles.langLabel, { fontFamily: fonts.ui, color: c.muted }]}>
            {t.onboarding.chooseLanguage}
          </Text>
          <LanguagePicker />
        </View>

        <Button label={isLast ? t.onboarding.startLabel : t.onboarding.continueLabel} onPress={next} fullWidth />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  wordmark: {
    fontSize: 34,
    lineHeight: 40,
  },
  skip: {
    fontSize: typeScale.small.size,
  },
  step: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  stepTitle: {
    fontSize: typeScale.title.size,
    lineHeight: typeScale.title.lineHeight,
    textAlign: 'center',
  },
  stepBody: {
    fontSize: typeScale.body.size,
    lineHeight: typeScale.body.lineHeight,
    textAlign: 'center',
    maxWidth: 340,
  },
  footer: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.lg,
  },
  langBox: {
    gap: spacing.sm,
  },
  langLabel: {
    fontSize: typeScale.caption.size,
  },
});