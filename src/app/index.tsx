import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  LanguagePicker,
  OnboardingArt,
  StepDots,
  StepPager,
  type OnboardingArtSize,
  type OnboardingArtVariant,
} from "@/components/onboarding";
import { Button } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { useT } from "@/i18n";
import { fontRoles, layout, spacing, typeScale } from "@/theme";

const STEPS: {
  art: OnboardingArtVariant;
  titleKey: "slide1Title" | "slide2Title" | "slide3Title";
  bodyKey: "slide1Body" | "slide2Body" | "slide3Body";
}[] = [
  { art: "craft", titleKey: "slide1Title", bodyKey: "slide1Body" },
  { art: "fonts", titleKey: "slide2Title", bodyKey: "slide2Body" },
  { art: "share", titleKey: "slide3Title", bodyKey: "slide3Body" },
];

/** Compact art on short viewports (landscape phones, short desktop windows). */
function artSizeFor(height: number): OnboardingArtSize {
  if (height < 640) {
    return "sm";
  }
  return height > 900 ? "lg" : "md";
}

/**
 * Floor for the step area per art size. The pager's pages are absolutely
 * positioned, so they contribute no intrinsic height — without this the pager
 * would collapse inside the scroll parent on a short viewport.
 */
const STEP_MIN_HEIGHT: Record<OnboardingArtSize, number> = {
  sm: 300,
  md: 380,
  lg: 440,
};

export default function OnboardingScreen() {
  const router = useRouter();
  const { t, language } = useT();
  const { colors: c } = useTheme();
  const fonts = fontRoles[language];
  const { height: windowHeight } = useWindowDimensions();
  const artSize = artSizeFor(windowHeight);

  const [index, setIndex] = useState(0);

  const goToGallery = useCallback(
    () => router.replace("/(tabs)/gallery"),
    [router],
  );

  const renderStep = useCallback(
    (stepIndex: number) => {
      const step = STEPS[stepIndex];
      return (
        <View style={styles.step} accessibilityLiveRegion="polite">
          <OnboardingArt variant={step.art} size={artSize} />
          <Text
            style={[
              styles.stepTitle,
              { fontFamily: fonts.display, color: c.ink },
            ]}
          >
            {t.onboarding[step.titleKey]}
          </Text>
          <Text
            style={[styles.stepBody, { fontFamily: fonts.ui, color: c.muted }]}
          >
            {t.onboarding[step.bodyKey]}
          </Text>
        </View>
      );
    },
    [t, fonts, c, artSize],
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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Everything lives in one phone-proportioned column, centred on large
            displays — the paper background still bleeds to the window edges. */}
        <View style={styles.column}>
          {/* top bar: wordmark + skip */}
          <View style={styles.topBar}>
            <Text
              style={[
                styles.wordmark,
                { fontFamily: fonts.display, color: c.ink },
              ]}
            >
              مداد
            </Text>
            <Pressable
              onPress={goToGallery}
              accessibilityRole="button"
              hitSlop={12}
              style={({ pressed }) => [
                styles.skip,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text
                style={[
                  styles.skipLabel,
                  { fontFamily: fonts.ui, color: c.muted },
                ]}
              >
                {t.onboarding.skip}
              </Text>
            </Pressable>
          </View>

          <StepPager
            count={STEPS.length}
            index={index}
            onIndexChange={setIndex}
            renderStep={renderStep}
            isRTL={language === "ar"}
            minHeight={STEP_MIN_HEIGHT[artSize]}
          />

          {/* footer: dots + language + CTA */}
          <View style={styles.footer}>
            <StepDots count={STEPS.length} index={index} />

            <View style={styles.langBox}>
              <Text
                style={[
                  styles.langLabel,
                  { fontFamily: fonts.ui, color: c.muted },
                ]}
              >
                {t.onboarding.chooseLanguage}
              </Text>
              <LanguagePicker />
            </View>

            {/* The content column is the measure, so a full-width CTA reads as a
                generous phone-width button rather than a window-wide bar. */}
            <Button
              label={
                isLast ? t.onboarding.startLabel : t.onboarding.continueLabel
              }
              onPress={next}
              size="lg"
              fullWidth
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  column: {
    flexGrow: 1,
    width: "100%",
    maxWidth: layout.maxContent,
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.lg,
  },
  wordmark: {
    fontSize: 34,
    lineHeight: 40,
  },
  // Invisible 44pt target — the hit area is the point, not the glyph box.
  skip: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  skipLabel: {
    fontSize: typeScale.small.size,
  },
  step: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  stepTitle: {
    fontSize: typeScale.title.size,
    lineHeight: typeScale.title.lineHeight,
    textAlign: "center",
  },
  stepBody: {
    fontSize: typeScale.body.size,
    lineHeight: typeScale.body.lineHeight,
    textAlign: "center",
    maxWidth: 340,
  },
  footer: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.lg,
  },
  langBox: {
    gap: spacing.sm,
  },
  langLabel: {
    fontSize: typeScale.caption.size,
    textAlign: "center",
  },
});
