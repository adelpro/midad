import { I18nManager, Platform } from 'react-native';

/**
 * Deterministic row direction.
 *
 * Auto-mirroring sources:
 * - Native: the cold-start check in `apply-direction.ts` forces the direction
 *   and reloads before the first frame, so Yoga mirrors `row` from launch.
 * - Web: `I18nProvider` sets `document.documentElement.dir`, and CSS flexbox
 *   mirrors rows natively from document direction.
 *
 * The manual `row-reverse` branch is the safety net for the one case neither
 * source covers: a platform that refused to flip (`apply-direction` reports
 * `blocked`), where this session would otherwise render LTR. Anywhere
 * auto-mirroring is active, flipping again would double-flip back.
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
