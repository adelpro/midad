import { useColorScheme } from 'react-native';

import { useSettings, type ThemePreference } from '@/storage/settings';
import { palettes, type ColorScheme, type MidadPalette } from '@/theme/tokens';

export interface ThemeValue {
  scheme: ColorScheme;
  isDark: boolean;
  colors: MidadPalette;
}

function resolveScheme(preference: ThemePreference, system: string | null): ColorScheme {
  if (preference === 'light') {
    return 'light';
  }
  if (preference === 'dark') {
    return 'dark';
  }
  return system === 'dark' ? 'dark' : 'light';
}

/** Resolve the active palette from the user's theme preference (or system). */
export function useTheme(): ThemeValue {
  const system = useColorScheme();
  const theme = useSettings((s) => s.theme);
  const scheme = resolveScheme(theme, system);
  return {
    scheme,
    isDark: scheme === 'dark',
    colors: palettes[scheme],
  };
}