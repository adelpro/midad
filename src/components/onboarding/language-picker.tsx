import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { fontRoles, layout, radius, spacing } from '@/theme';

export function LanguagePicker() {
  const { colors: c } = useTheme();
  const { t, language, setLanguage } = useT();
  const fonts = fontRoles[language];

  return (
    <View style={[styles.segment, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
      {(['ar', 'en'] as const).map((lang) => {
        const active = language === lang;
        return (
          <Pressable
            key={lang}
            onPress={() => setLanguage(lang)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.segmentItem,
              { backgroundColor: active ? c.ink : 'transparent', opacity: pressed ? 0.8 : 1 },
            ]}>
            <Text
              style={[
                styles.segmentLabel,
                {
                  fontFamily: active ? fonts.uiBold : fonts.ui,
                  color: active ? c.onInk : c.muted,
                },
              ]}>
              {lang === 'ar' ? t.onboarding.arabic : t.onboarding.english}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
    // Cap the track so the two segments keep a phone-proportioned width on
    // large displays instead of stretching into a full-window pill.
    width: '100%',
    maxWidth: layout.maxControl,
    alignSelf: 'center',
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
  },
  segmentLabel: {
    fontSize: 14,
    letterSpacing: 0.01,
  },
});