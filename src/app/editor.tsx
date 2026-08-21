import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

export default function EditorScreen() {
  const { t } = useT();
  const { colors: c } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.paper }]}>
      <View style={styles.center}>
        <EmptyState
          glyph="قلم"
          title={t.editor.newProject}
          description={id ? `${t.editor.comingSoon} (${id})` : t.editor.comingSoon}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
});