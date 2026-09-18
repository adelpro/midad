import { I18nManager, Platform } from 'react-native';

/**
 * Deterministic row direction.
 *
 * Auto-mirroring sources:
 * - Native: Yoga mirrors `row` once `forceRTL` is active (after restart).
 * - Web: `I18nProvider` sets `document.documentElement.dir`, and CSS flexbox
 *   mirrors rows natively from document direction.
 *
 * Manual `row-reverse` is only needed on native *before* the restart kicks in —
 * anywhere auto-mirroring is active, flipping again would double-flip back.
 */
export function rowStyle(isRTL: boolean) {
  const mirrorsAutomatically =
    Platform.OS === 'web'
      ? typeof document !== 'undefined' &&
        document.documentElement.dir === 'rtl'
      : I18nManager.isRTL;
  return {
    flexDirection:
      isRTL && !mirrorsAutomatically
        ? ('row-reverse' as const)
        : ('row' as const),
  };
}
