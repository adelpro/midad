import type { PropsWithChildren } from 'react';
import { createContext, useContext, useLayoutEffect, useMemo } from 'react';
import { Platform } from 'react-native';

import { strings, type Language, type Translation } from '@/i18n/strings';
import { useSettings } from '@/storage/settings';

interface I18nContextValue {
  language: Language;
  isRTL: boolean;
  t: Translation;
  setLanguage: (lang: Language) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
  const { language, setLanguage } = useSettings();

  // Native direction is settled once per cold start, behind the launch screen:
  // `applyLayoutDirection` (called from `use-bootstrap`) forces the direction
  // and reloads if it changed. Applying it here, after the first render, was the
  // bug — native had already fixed its direction for the launch.

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
