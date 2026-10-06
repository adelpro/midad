/**
 * The pure half of the layout-direction switch.
 *
 * Native platforms fix `I18nManager.isRTL` before JS runs and only re-read it on
 * the next launch, so the app cannot mirror a language it is not already
 * configured for. `apply-direction.ts` closes that by forcing the direction and
 * reloading the JS bundle **once** — this module decides when.
 *
 * Kept import-free so `scripts/check-rtl-direction.mjs` can transpile and
 * evaluate it standalone (the same rule `theme/icon-sets.ts` follows).
 */

/** The languages whose direction the app switches between. */
export type DirectionLanguage = 'ar' | 'en';

/** The direction a language wants its interface to render in. */
export function desiredRTL(language: DirectionLanguage): boolean {
  return language === 'ar';
}

export interface DirectionReloadInput {
  /** `Platform.OS`. */
  platform: string;
  /** `I18nManager.isRTL` as captured for this launch. */
  currentRTL: boolean;
  /** The language the settings store has hydrated. */
  language: DirectionLanguage;
  /**
   * The language this device was last reloaded for, or `null` if never. This is
   * the loop guard: a platform that refuses to flip would otherwise reload on
   * every launch forever.
   */
  lastForcedLanguage: DirectionLanguage | null;
}

/**
 * Whether the current launch must force a direction and reload.
 *
 * `false` when already correct, when web (whose `document.dir` mirrors live), or
 * when this exact language already triggered a reload that did not take.
 */
export function needsDirectionReload(input: DirectionReloadInput): boolean {
  if (input.platform === 'web') {
    return false;
  }
  if (input.currentRTL === desiredRTL(input.language)) {
    return false;
  }
  if (input.lastForcedLanguage === input.language) {
    return false;
  }
  return true;
}
