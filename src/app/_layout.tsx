import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BrandLoader } from '@/components/ui';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { useTheme } from '@/hooks/use-theme';
import { I18nProvider } from '@/i18n';

SplashScreen.preventAutoHideAsync();
// The brand loader is the in-app cover (spec D8: never the native splash), so
// this handoff should read as one continuous arrival into the first route
// rather than a hard cut from a still frame.
//
// iOS only: `fade` is annotated `@platform ios` in expo-splash-screen's own
// types, and Android hides the splash with its own window animation. Passing it
// unconditionally would imply a cross-platform arrival that only one platform
// gets — and this is the one boot path Android has no other way to verify.
if (Platform.OS === 'ios') {
  SplashScreen.setOptions({ fade: true, duration: 200 });
}

/**
 * The launch cover's mark height. It matches the splash's visible logo
 * (`imageWidth` 200 × the asset's 0.72 crop = 144 dp), so the mark does not
 * change size when the native splash hands off to this cover.
 */
const LAUNCH_COVER_HEIGHT = 144;

export default function RootLayout() {
  const { ready, error, hydrated } = useBootstrap();
  const { colors: c, isDark } = useTheme();

  /**
   * False for the first render, always — and that is the point.
   *
   * The web build is a static export, so `/gallery` ships as HTML rendered on a
   * server with no storage and no `document`, and React hydrates it. Everything
   * below reads state that only the client can know: `hasHydrated()` has always
   * answered `true` by the time React first renders on the web (the store
   * module hydrates while the route is being loaded), so the first client render
   * mounted `<Stack>` — and its frame-measuring child — where the server HTML
   * had only the empty shell. React cannot reconcile that and regenerates the
   * whole tree (`#418`, four times per load).
   *
   * Holding the client-only branches until after mount makes the first client
   * render byte-identical to the server's, which is what hydration needs. The
   * cost is one extra render before the Stack mounts, inside a frame the launch
   * cover already owns.
   */
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration flag: the first render has to match the server, so it cannot be true yet
    setMounted(true);
  }, []);

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
        {mounted && (ready || error) && (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: c.paper },
            }}
          />
        )}
        {/*
         * The launch cover: the native splash hides as soon as the theme is
         * known (`useBootstrap`), and this covers the remaining font wait with
         * the same pulse the editor uses. It unmounts on the same `ready`
         * transition that mounts the Stack, so it adds no latency and can never
         * strand the app on a cover. Reduce Motion rests the mark (BrandLoader).
         */}
        {mounted && hydrated && !ready && !error && (
          <View style={StyleSheet.absoluteFill}>
            <BrandLoader height={LAUNCH_COVER_HEIGHT} />
          </View>
        )}
      </I18nProvider>
    </GestureHandlerRootView>
  );
}
