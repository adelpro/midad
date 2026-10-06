import { reloadAppAsync } from 'expo';
import { I18nManager, Platform } from 'react-native';

import {
  desiredRTL,
  needsDirectionReload,
  type DirectionLanguage,
} from '@/i18n/rtl-direction';
import {
  getLastForcedLanguage,
  setLastForcedLanguage,
} from '@/storage/layout-direction';

export type ApplyDirectionResult = 'match' | 'reloaded' | 'blocked';

/**
 * Make the native interface direction agree with `language`.
 *
 * Native platforms read `I18nManager.isRTL` once, before JS runs, so a language
 * whose direction differs only takes effect after a reload. This forces the
 * direction (`allowRTL` as well as `forceRTL`, because `forceRTL(false)` alone
 * cannot override an RTL device locale), then reloads **once**. The reload
 * happens behind the launch screen (`use-bootstrap.ts`), and the persisted
 * decision means the next launch starts already correct and does not reload.
 *
 * `use-bootstrap.ts` awaits this before it hides the splash, so the app never
 * paints an LTR frame for an RTL language.
 */
export async function applyLayoutDirection(
  language: DirectionLanguage,
): Promise<ApplyDirectionResult> {
  if (Platform.OS === 'web') {
    // `I18nProvider` sets `document.documentElement.dir`, which mirrors live.
    return 'match';
  }

  const want = desiredRTL(language);
  const current = I18nManager.isRTL;
  const lastForcedLanguage = await getLastForcedLanguage();

  // Persist unconditionally: these are the values the next launch reads, and
  // writing them now is what lets a reload that never happens still be repaired
  // on the next cold start.
  I18nManager.allowRTL(want);
  I18nManager.forceRTL(want);

  if (
    !needsDirectionReload({
      platform: Platform.OS,
      currentRTL: current,
      language,
      lastForcedLanguage,
    })
  ) {
    // `blocked`: already forced for this language and still wrong, so this is a
    // platform that will not flip. Proceed in whatever direction it chose
    // rather than reload forever.
    return lastForcedLanguage === language && current !== want
      ? 'blocked'
      : 'match';
  }

  await setLastForcedLanguage(language);
  try {
    await reloadAppAsync('midad: layout direction');
  } catch {
    // The platform refused to reload. The forced preference is written, so the
    // next cold start still lands correct; this session keeps what it has.
    return 'blocked';
  }
  return 'reloaded';
}
