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
// The brand loader is the in-app cover (spec D8: never the native splash), so
// this handoff should read as one continuous arrival into the first route
// rather than a hard cut from a still frame.
SplashScreen.setOptions({ fade: true, duration: 200 });

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
            {/* Styling for @expo/ui's Vaul drawer (see public/midad-web.css):
                caps the sheet at the max content width, centres it, and honours
                reduced motion — none of which the expo-ui wrapper exposes. */}
            <link rel="stylesheet" href="/midad-web.css" />
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
