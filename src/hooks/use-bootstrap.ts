import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { useSettings } from '@/storage/settings';
import { coreFontAssets } from '@/theme';

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

/**
 * Hold the launch until the UI is actually able to draw itself.
 *
 * The gate is the **core** set — Cairo, Amiri and Geist — and nothing else.
 * Those are the only faces the first screen needs, so they are the only faces
 * whose absence is visible before the user can act. The forty-one calligraphic
 * display faces are loaded on demand instead, when a design that names them is
 * opened, behind the brand loader (see `docs/editor-font-loading.md`); making
 * the splash wait for faces no screen is showing would trade a real wait for an
 * invisible one.
 *
 * The native splash is hidden as soon as the persisted settings have hydrated,
 * **not** when the fonts have loaded. Hydration is what decides the theme, so
 * from that moment the app can paint a cover in the right colour; the fonts are
 * the remaining wait, and `_layout.tsx` covers it with `BrandLoader` so the
 * arrival reads as one continuous mark rather than a still frame replaced by a
 * route. Hiding at `ready` instead would leave that cover behind the native
 * splash for the whole font load — which is the same as having no cover.
 */
export function useBootstrap() {
  const [fontsLoaded, fontError] = useFonts(coreFontAssets);
  const settingsHydrated = useSettingsHydrated();

  useEffect(() => {
    if (settingsHydrated) {
      SplashScreen.hideAsync();
    }
  }, [settingsHydrated]);

  return {
    ready: !!fontsLoaded && !fontError && settingsHydrated,
    // Withheld until hydration, so a font error cannot let the root layout
    // render past the gate on defaults.
    error: settingsHydrated ? (fontError ?? null) : null,
    /** Whether the theme and persisted settings are known. Gates the launch cover. */
    hydrated: settingsHydrated,
  };
}
