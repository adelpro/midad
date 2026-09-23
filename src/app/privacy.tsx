import { useRouter } from 'expo-router';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { fontRoles, spacing, typeScale } from '@/theme';

/**
 * The public contact address and hosted policy URL. Google Play compares these
 * against the store listing — keep them identical to the Play Console entry.
 * The hosted URL serves this very screen on the web build, so the app copy and
 * the published policy cannot drift apart.
 */
const CONTACT_EMAIL = 'adelpro@gmail.com';
const HOSTED_POLICY_URL = 'https://midad.adelpro.us.kg/privacy';

function Link({
  label,
  onPress,
  color,
  testID,
}: {
  label: string;
  onPress: () => void;
  color: string;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Text style={[styles.link, { color }]}>{label}</Text>
    </Pressable>
  );
}

export default function PrivacyScreen() {
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
            {t.privacyPage.title}
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
            {t.privacyPage.intro}
          </Text>
          <Text
            style={[styles.caption, { fontFamily: fonts.ui, color: c.muted }]}
          >
            {t.privacyPage.lastUpdated}
          </Text>
        </View>

        {t.privacyPage.sections.map((section) => (
          <View
            key={section.title}
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
              {section.title}
            </Text>
            <Text
              style={[styles.body, { fontFamily: fonts.ui, color: c.muted }]}
            >
              {section.body}
            </Text>
          </View>
        ))}

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
            {t.privacyPage.contactTitle}
          </Text>
          <Text style={[styles.body, { fontFamily: fonts.ui, color: c.muted }]}>
            {t.privacyPage.contactBody}
          </Text>
          <Link
            label={CONTACT_EMAIL}
            color={c.accentText}
            onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
            testID="privacy-contact-email"
          />
          <Link
            label={t.privacyPage.hostedLabel}
            color={c.accentText}
            onPress={() => Linking.openURL(HOSTED_POLICY_URL)}
            testID="privacy-hosted-link"
          />
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
  caption: {
    fontSize: typeScale.caption.size,
    lineHeight: typeScale.caption.lineHeight,
  },
  link: {
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
    textDecorationLine: 'underline',
  },
});
