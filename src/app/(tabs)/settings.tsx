import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import {
  AUTO_SAVE_INTERVALS_MS,
  useSettings,
  type ThemePreference,
} from '@/storage/settings';
import { fontRoles, spacing, typeScale } from '@/theme';

function SectionLabel({ children }: { children: string }) {
  const { colors: c } = useTheme();
  const { language } = useT();
  return (
    <Text
      style={[
        styles.sectionLabel,
        { fontFamily: fontRoles[language].uiBold, color: c.muted },
      ]}
    >
      {children}
    </Text>
  );
}

function ChoiceButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      label={label}
      variant={active ? 'primary' : 'secondary'}
      onPress={onPress}
      style={styles.choiceBtn}
    />
  );
}

export default function SettingsScreen() {
  const { t, language } = useT();
  const { colors: c } = useTheme();
  const fonts = fontRoles[language];
  const {
    theme,
    setTheme,
    language: lang,
    setLanguage,
    autoSaveEnabled,
    autoSaveIntervalMs,
    setAutoSaveEnabled,
    setAutoSaveInterval,
  } = useSettings();
  const router = useRouter();
  const [languageJustChanged, setLanguageJustChanged] = useState(false);

  const changeLanguage = (next: 'ar' | 'en') => {
    if (next !== lang) {
      setLanguage(next);
      setLanguageJustChanged(true);
    }
  };

  const themeOptions: { key: ThemePreference; label: string }[] = [
    { key: 'system', label: t.settings.themeSystem },
    { key: 'light', label: t.settings.themeLight },
    { key: 'dark', label: t.settings.themeDark },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.paper }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        // Web keeps the scrollbar: it is the only cue that Settings continues
        // below the fold on a laptop. Native hides it — iOS/Android draw their
        // own transient indicator, so the gutter would only cost width.
        // NB: on web react-native-web turns `false` into `scrollbar-width:
        // none`, so the condition has to be `=== "web"`, not `!== "web"`.
        showsVerticalScrollIndicator={Platform.OS === 'web'}
      >
        <Text
          style={[styles.title, { fontFamily: fonts.uiBold, color: c.ink }]}
        >
          {t.settings.title}
        </Text>

        <SectionLabel>{t.settings.languageSection}</SectionLabel>
        <View
          style={[
            styles.row,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text
            style={[styles.rowLabel, { fontFamily: fonts.ui, color: c.ink }]}
          >
            {t.settings.languageHint}
          </Text>
          <View style={styles.choiceRow}>
            <ChoiceButton
              label="العربية"
              active={lang === 'ar'}
              onPress={() => changeLanguage('ar')}
            />
            <ChoiceButton
              label="English"
              active={lang === 'en'}
              onPress={() => changeLanguage('en')}
            />
          </View>
        </View>
        {languageJustChanged && (
          <Text
            style={[
              styles.restartNotice,
              { color: c.accentText, fontFamily: fonts.ui },
            ]}
          >
            {t.settings.restartNotice}
          </Text>
        )}

        <SectionLabel>{t.settings.themeSection}</SectionLabel>
        <View
          style={[
            styles.row,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text
            style={[styles.rowLabel, { fontFamily: fonts.ui, color: c.ink }]}
          >
            {t.settings.themeHint}
          </Text>
          <View style={styles.choiceRow}>
            {themeOptions.map((opt) => (
              <ChoiceButton
                key={opt.key}
                label={opt.label}
                active={theme === opt.key}
                onPress={() => setTheme(opt.key)}
              />
            ))}
          </View>
        </View>

        <SectionLabel>{t.settings.autoSaveSection}</SectionLabel>
        <View
          style={[
            styles.row,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <View style={styles.settingLabelWrap}>
            <Text
              style={[styles.rowLabel, { fontFamily: fonts.ui, color: c.ink }]}
            >
              {t.settings.autoSaveHint}
            </Text>
            <Text
              style={[
                styles.settingHint,
                { fontFamily: fonts.ui, color: c.muted },
              ]}
            >
              {autoSaveEnabled ? t.settings.autoSaveOn : t.settings.autoSaveOff}
            </Text>
          </View>
          <Toggle
            value={autoSaveEnabled}
            onValueChange={setAutoSaveEnabled}
            accessibilityLabel={t.settings.autoSaveHint}
          />
        </View>
        <View
          style={[
            styles.row,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              opacity: autoSaveEnabled ? 1 : 0.5,
            },
          ]}
        >
          <View style={styles.settingLabelWrap}>
            <Text
              style={[styles.rowLabel, { fontFamily: fonts.ui, color: c.ink }]}
            >
              {t.settings.autoSaveInterval}
            </Text>
            <Text
              style={[
                styles.settingHint,
                { fontFamily: fonts.ui, color: c.muted },
              ]}
            >
              {t.settings.autoSaveIntervalHint}
            </Text>
          </View>
          <View style={styles.choiceRow}>
            {AUTO_SAVE_INTERVALS_MS.map((value, index) => {
              const labels = [
                t.settings.autoSaveEvery10s,
                t.settings.autoSaveEvery30s,
                t.settings.autoSaveEvery1m,
                t.settings.autoSaveEvery5m,
              ] as const;
              return (
                <ChoiceButton
                  key={value}
                  label={labels[index] ?? labels[0]}
                  active={autoSaveIntervalMs === value}
                  onPress={() => {
                    if (autoSaveEnabled) setAutoSaveInterval(value);
                  }}
                />
              );
            })}
          </View>
        </View>

        <SectionLabel>{t.settings.onboardingSection}</SectionLabel>
        <View
          style={[
            styles.row,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text
            style={[styles.rowLabel, { fontFamily: fonts.ui, color: c.ink }]}
          >
            {t.settings.onboardingReplayHint}
          </Text>
          {/* Pushes the intro on top of the tabs. It pops back to this screen on
              Start/Skip because it is opened with `?from=settings` — and the
              completed flag is left set, so it never returns on its own. */}
          <View style={styles.choiceRow}>
            <Button
              label={t.settings.onboardingReplay}
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: '/onboarding',
                  params: { from: 'settings' },
                })
              }
              style={styles.choiceBtn}
            />
          </View>
        </View>

        <View style={styles.group}>
          <View
            style={[
              styles.row,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text
              style={[
                styles.rowLabel,
                { fontFamily: fonts.ui, color: c.muted },
              ]}
            >
              {t.settings.version} {Constants.expoConfig?.version ?? '1.0.0'}
            </Text>
          </View>
          <View
            style={[
              styles.row,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text
              style={[
                styles.rowLabel,
                { fontFamily: fonts.ui, color: c.muted },
              ]}
            >
              {t.settings.credits}
            </Text>
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
  container: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: typeScale.title.size,
    lineHeight: typeScale.title.lineHeight,
    letterSpacing: typeScale.title.letterSpacing,
  },
  sectionLabel: {
    fontSize: typeScale.caption.size,
    textTransform: 'uppercase',
    letterSpacing: 0.05,
    marginTop: spacing.sm,
  },
  group: {
    gap: spacing.sm,
  },
  row: {
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  rowLabel: {
    alignSelf: 'stretch',
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
  },
  settingLabelWrap: { flex: 1, gap: spacing.xs },
  settingHint: {
    fontSize: typeScale.caption.size,
    lineHeight: typeScale.caption.lineHeight,
  },
  choiceRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  choiceBtn: {
    alignSelf: 'center',
    width: undefined,
    maxWidth: 200,
  },
  restartNotice: {
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
    paddingHorizontal: spacing.lg,
  },
});
