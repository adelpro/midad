import { useColorScheme } from 'react-native';

import { palettes, type ColorScheme, type MidadPalette } from '@/theme/tokens';

export interface ThemeValue {
  scheme: ColorScheme;
  isDark: boolean;
  colors: MidadPalette;
}

/** Resolve the active palette from the system color scheme. */
export function useTheme(): ThemeValue {
  const system = useColorScheme();
  const scheme: ColorScheme = system === 'dark' ? 'dark' : 'light';
  return {
    scheme,
    isDark: scheme === 'dark',
    colors: palettes[scheme],
  };
}