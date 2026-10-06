import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DirectionLanguage } from '@/i18n/rtl-direction';

/**
 * The device-local record of the language this install last reloaded for.
 *
 * This is the loop guard's storage, not a user preference: `apply-direction.ts`
 * writes it just before it reloads, and reads it on the next launch to refuse a
 * second reload for the same language. It lives outside the settings store
 * because the store rehydrates after the direction check has already run.
 */
const KEY = 'midad:layout-direction';

/** The last language the app forced a reload for, or `null` if never. */
export async function getLastForcedLanguage(): Promise<DirectionLanguage | null> {
  try {
    const value = await AsyncStorage.getItem(KEY);
    return value === 'ar' || value === 'en' ? value : null;
  } catch {
    // A read that fails only lets one extra reload through; never fatal.
    return null;
  }
}

/** Remember the language a reload is being forced for. Best effort. */
export async function setLastForcedLanguage(
  language: DirectionLanguage,
): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, language);
  } catch {
    // A write that fails costs at most one redundant reload next launch.
  }
}
