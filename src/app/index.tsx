import { Redirect } from "expo-router";

import { useSettings } from "@/storage/settings";

/**
 * The launch gate — the one thing `/` does.
 *
 * It renders no UI: it only decides which route a cold start lands on, the intro
 * on a first run and the gallery after that. Keeping the decision here (rather
 * than in the intro screen) means the intro stays a plain, always-reachable
 * route, which is what lets Settings replay it.
 *
 * Reading a *persisted* preference this early is only safe because
 * `useBootstrap` keeps the splash up until the settings store has rehydrated —
 * otherwise this would decide against the store's defaults and bounce a
 * returning user into the intro. `Redirect` is used rather than a `useEffect`
 * + `router.replace` so nothing renders in the wrong place first.
 */
export default function LaunchGate() {
  const hasCompletedOnboarding = useSettings((s) => s.hasCompletedOnboarding);

  return (
    <Redirect
      href={hasCompletedOnboarding ? "/(tabs)/gallery" : "/onboarding"}
    />
  );
}
