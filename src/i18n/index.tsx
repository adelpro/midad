import type { PropsWithChildren } from 'react';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
} from 'react';
import { I18nManager, Platform } from 'react-native';

import * as Localization from 'expo-localization';

import { strings, type Language, type Translation } from '@/i18n/strings';
import { useSettings } from '@/storage/settings';

interface I18nContextValue {
  language: Language;
  isRTL: boolean;
  t: Translation;
  setLanguage: (lang: Language) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/** Detect a preferred language from device locale (Arabic-first). */
export function detectLanguage(): Language {
  const locales = Localization.getLocales();
  for (const loc of locales) {
    const tag = loc.languageTag.toLowerCase();
    if (tag.startsWith('ar')) {
      return 'ar';
    }
  }
  return 'en';
}

export function I18nProvider({ children }: PropsWithChildren) {
  const { language, setLanguage } = useSettings();

  // Apply RTL on first render for the current language. `I18nManager.forceRTL`
  // is a no-op after launch on iOS, so we persist the choice from settings.
  useEffect(() => {
    const isRTL = language === 'ar';
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.forceRTL(isRTL);
    }
  }, [language]);

  // On web, react-native-web compiles to real CSS flexbox, which mirrors
  // natively from the document direction — tab bar order, flex rows, logical
  // margins. Setting `dir` here gives us live RTL mirroring without a reload.
  // (useLayoutEffect so it applies before first paint, avoiding an LTR flash.)
  useLayoutEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const isRTL = language === 'ar';
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
    }
  }, [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      isRTL: language === 'ar',
      t: strings[language],
      setLanguage,
    }),
    [language, setLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useT must be used within I18nProvider');
  }
  return ctx;
}
