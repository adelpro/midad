import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { fontRoles, spacing, typeScale } from '@/theme';

export default function AboutScreen() {
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
        <View style={styles.headerRow}>
          <Text
            style={[styles.title, { fontFamily: fonts.display, color: c.ink }]}
          >
            {t.aboutPage.title}
          </Text>
          <Button
            label={t.common.back}
            variant="secondary"
            onPress={() => router.back()}
          />
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={[styles.body, { fontFamily: fonts.ui, color: c.ink }]}>
            {t.aboutPage.body}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { fontFamily: fonts.uiBold, color: c.ink },
            ]}
          >
            {t.aboutPage.missionTitle}
          </Text>
          <Text style={[styles.body, { fontFamily: fonts.ui, color: c.muted }]}>
            {t.aboutPage.mission}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { fontFamily: fonts.uiBold, color: c.ink },
            ]}
          >
            {t.settings.version}
          </Text>
          <Text style={[styles.body, { fontFamily: fonts.ui, color: c.muted }]}>
            {t.aboutPage.versionLabel}:{' '}
            {Constants.expoConfig?.version ?? '0.2.0'}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={[styles.body, { fontFamily: fonts.ui, color: c.muted }]}>
            {t.aboutPage.developedBy}
          </Text>
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
    padding: spacing.xl,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: typeScale.title.size,
    lineHeight: typeScale.title.lineHeight,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
  },
  body: {
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
  },
});
