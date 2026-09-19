import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { fontRoles, spacing, typeScale } from '@/theme';

export default function MoreScreen() {
  const router = useRouter();
  const { t, language } = useT();
  const { colors: c } = useTheme();
  const fonts = fontRoles[language];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.paper }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[styles.title, { fontFamily: fonts.uiBold, color: c.ink }]}
        >
          {t.tabs.more}
        </Text>
        <Text style={[styles.intro, { fontFamily: fonts.ui, color: c.muted }]}>
          {t.settings.aboutBody}
        </Text>

        <View style={styles.list}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/about')}
            style={({ pressed }) => [
              styles.item,
              {
                backgroundColor: pressed ? c.surfacePressed : c.surface,
                borderColor: c.border,
              },
            ]}
          >
            <Text
              style={[
                styles.itemText,
                { fontFamily: fonts.uiBold, color: c.ink },
              ]}
            >
              {t.settings.aboutLink}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/privacy')}
            style={({ pressed }) => [
              styles.item,
              {
                backgroundColor: pressed ? c.surfacePressed : c.surface,
                borderColor: c.border,
              },
            ]}
          >
            <Text
              style={[
                styles.itemText,
                { fontFamily: fonts.uiBold, color: c.ink },
              ]}
            >
              {t.settings.privacyLink}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  container: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: typeScale.title.size,
    lineHeight: typeScale.title.lineHeight,
  },
  intro: {
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
    marginBottom: spacing.md,
  },
  list: { gap: spacing.sm },
  item: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  itemText: {
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
  },
});
