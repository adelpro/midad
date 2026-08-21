import Constants from 'expo-constants';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { useSettings, type ThemePreference } from '@/storage/settings';
import { fontRoles, spacing, typeScale } from '@/theme';

function SectionLabel({ children }: { children: string }) {
  const { colors: c } = useTheme();
  const { language } = useT();
  return (
    <Text
      style={[
        styles.sectionLabel,
        { fontFamily: fontRoles[language].uiBold, color: c.muted },
      ]}>
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
  const { theme, setTheme, language: lang, setLanguage } = useSettings();

  const themeOptions: { key: ThemePreference; label: string }[] = [
    { key: 'system', label: t.settings.themeSystem },
    { key: 'light', label: t.settings.themeLight },
    { key: 'dark', label: t.settings.themeDark },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.paper }]}>
      <View style={styles.container}>
        <Text style={[styles.title, { fontFamily: fonts.uiBold, color: c.ink }]}>
          {t.settings.title}
        </Text>

        <SectionLabel>{t.settings.languageSection}</SectionLabel>
        <View style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.rowLabel, { fontFamily: fonts.ui, color: c.ink }]}>
            {t.settings.languageHint}
          </Text>
          <View style={styles.choiceRow}>
            <ChoiceButton
              label="العربية"
              active={lang === 'ar'}
              onPress={() => setLanguage('ar')}
            />
            <ChoiceButton
              label="English"
              active={lang === 'en'}
              onPress={() => setLanguage('en')}
            />
          </View>
        </View>

        <SectionLabel>{t.settings.themeSection}</SectionLabel>
        <View style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.rowLabel, { fontFamily: fonts.ui, color: c.ink }]}>
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

        <SectionLabel>{t.settings.aboutSection}</SectionLabel>
        <View style={styles.group}>
          <View style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.rowLabel, { fontFamily: fonts.ui, color: c.ink }]}>
              {t.settings.aboutBody}
            </Text>
          </View>
          <View style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.rowLabel, { fontFamily: fonts.ui, color: c.muted }]}>
              {t.settings.version} {Constants.expoConfig?.version ?? '1.0.0'}
            </Text>
          </View>
          <View style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.rowLabel, { fontFamily: fonts.ui, color: c.muted }]}>
              {t.settings.credits}
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
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
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  rowLabel: {
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  choiceBtn: {
    flex: 1,
    minWidth: 96,
  },
});