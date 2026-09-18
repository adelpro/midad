import { StyleSheet, Text, View } from 'react-native';
import { useAnimatedStyle } from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/ui/pressable';
import { usePressFeedback } from '@/hooks/use-press-feedback';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { fontRoles, layout, radius, spacing } from '@/theme';

/**
 * One segment of the track.
 *
 * Split out of `LanguagePicker` because it owns press feedback — the hook
 * cannot be called from inside the parent's `map`.
 */
function SegmentItem({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors: c } = useTheme();
  const { language } = useT();
  const fonts = fontRoles[language];
  const press = usePressFeedback();

  const animStyle = useAnimatedStyle(() => ({
    opacity: press.pressed.value ? 0.8 : 1,
    transform: [{ scale: press.scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.segmentItem,
        { backgroundColor: active ? c.ink : 'transparent' },
        animStyle,
      ]}
    >
      <Text
        style={[
          styles.segmentLabel,
          {
            fontFamily: active ? fonts.uiBold : fonts.ui,
            color: active ? c.onInk : c.muted,
          },
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

export function LanguagePicker() {
  const { colors: c } = useTheme();
  const { t, language, setLanguage } = useT();

  return (
    <View
      style={[
        styles.segment,
        { backgroundColor: c.surfaceAlt, borderColor: c.border },
      ]}
    >
      {(['ar', 'en'] as const).map((lang) => (
        <SegmentItem
          key={lang}
          label={lang === 'ar' ? t.onboarding.arabic : t.onboarding.english}
          active={language === lang}
          onPress={() => setLanguage(lang)}
        />
      ))}
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
