import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useBootstrap } from '@/hooks/use-bootstrap';
import { useTheme } from '@/hooks/use-theme';
import { I18nProvider } from '@/i18n';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { ready, error } = useBootstrap();
  const { colors: c, isDark } = useTheme();

  if (!ready && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider>
        {/*
         * The bar follows the in-app theme, not the OS: the light/dark choice
         * is a user setting here and can differ from the system. Web is a
         * documented no-op, so this needs no platform guard.
         */}
        <StatusBar style={isDark ? 'light' : 'dark'} animated />
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
