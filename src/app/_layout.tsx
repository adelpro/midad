import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useBootstrap } from '@/hooks/use-bootstrap';
import { useTheme } from '@/hooks/use-theme';
import { I18nProvider } from '@/i18n';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { ready, error } = useBootstrap();
  const { colors: c } = useTheme();

  if (!ready && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider>
        {Platform.OS === 'web' && (
          <Head>
            <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          </Head>
        )}
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: c.paper },
          }}
        />
      </I18nProvider>
    </GestureHandlerRootView>
  );
}
