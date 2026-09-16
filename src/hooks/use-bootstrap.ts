import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { useSettings } from '@/storage/settings';
import { fontAssets } from '@/theme';

/** How long the launch waits for the settings store before using defaults. */
const HYDRATION_GRACE_MS = 1_500;

/**
 * Whether the persisted settings store has finished rehydrating.
 *
 * `persist` reads AsyncStorage asynchronously, so the very first render sees the
 * store's defaults. Any decision that depends on a *stored* preference — the
 * onboarding gate in `app/index.tsx` reads `hasCompletedOnboarding` — would then
 * be made against `false` and flash the intro at a returning user on every cold
 * start. Holding the splash until hydration lands closes that window instead of
 * papering over it with a post-mount redirect.
 */
function useSettingsHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() =>
    useSettings.persist.hasHydrated(),
  );

  useEffect(() => {
    if (useSettings.persist.hasHydrated()) {
      // Hydration landed between the first render and this effect. That is the
      // common case, not the exotic one — the storage read starts when the store
      // module is first evaluated, before React has finished rendering — so
      // leaning on the subscription alone would add the whole grace period to
      // every warm start.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot reconciliation with an external store that already settled
      setHydrated(true);
      return;
    }

    // A storage read that never settles must not hold the splash forever: after
    // the grace period the store's defaults are used instead. The worst case is
    // one unnecessary intro on a malfunctioning device, not an app that never
    // starts.
    const timer = setTimeout(() => setHydrated(true), HYDRATION_GRACE_MS);
    const unsubscribe = useSettings.persist.onFinishHydration(() => {
      clearTimeout(timer);
      setHydrated(true);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return hydrated;
}

export function useBootstrap() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const settingsHydrated = useSettingsHydrated();

  useEffect(() => {
    if ((fontsLoaded || fontError) && settingsHydrated) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, settingsHydrated]);

  return {
    ready: !!fontsLoaded && !fontError && settingsHydrated,
    // Withheld until hydration, so a font error cannot let the root layout
    // render past the gate on defaults.
    error: settingsHydrated ? (fontError ?? null) : null,
  };
}