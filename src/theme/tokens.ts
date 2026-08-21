/**
 * midad design tokens — warm ink minimalist system.
 * Two palettes (light paper / dark ink) + spacing, radii, shadows, motion, type.
 */

export interface MidadPalette {
  // Canvas & surfaces
  paper: string; // app background
  paperBright: string; // brighter paper
  surface: string; // cards / sheets
  surfaceAlt: string; // subtle surface
  surfacePressed: string; // pressed surface

  // Ink — text & solids
  ink: string; // primary text / solid CTA
  inkSoft: string; // secondary strong text
  muted: string; // secondary text
  faint: string; // tertiary text / disabled
  onInk: string; // text on ink

  // Structural lines
  border: string; // hairline borders
  borderStrong: string; // stronger dividers

  // Accent — ink-saffron, used sparingly
  accent: string;
  accentText: string;
  accentSoft: string; // accent tint background

  // Pale pastels (tags / semantic hints)
  paleRed: { bg: string; text: string };
  paleBlue: { bg: string; text: string };
  paleGreen: { bg: string; text: string };
  paleYellow: { bg: string; text: string };

  // Semantic
  danger: string;
  dangerBg: string;
  success: string;
  successBg: string;

  // Shadows
  shadowColor: string;
  shadowOpacity: number;
}

export type ColorScheme = 'light' | 'dark';

/** Light — warm bone / paper. */
const lightColors: MidadPalette = {
  paper: '#F7F6F3',
  paperBright: '#FBFBFA',
  surface: '#FFFFFF',
  surfaceAlt: '#F9F9F8',
  surfacePressed: '#EFEEE9',

  ink: '#111111',
  inkSoft: '#2F3437',
  muted: '#787774',
  faint: '#A9A69F',
  onInk: '#FFFFFF',

  border: '#EAEAEA',
  borderStrong: '#D8D5CE',

  accent: '#B0894F',
  accentText: '#956400',
  accentSoft: '#F5EEE2',

  paleRed: { bg: '#FDEBEC', text: '#9F2F2D' },
  paleBlue: { bg: '#E1F3FE', text: '#1F6C9F' },
  paleGreen: { bg: '#EDF3EC', text: '#346538' },
  paleYellow: { bg: '#FBF3DB', text: '#956400' },

  danger: '#9F2F2D',
  dangerBg: '#FDEBEC',
  success: '#346538',
  successBg: '#EDF3EC',

  shadowColor: '#111111',
  shadowOpacity: 0.06,
};

/** Dark — warm ink / charcoal. Inverts paper↔ink. */
const darkColors: MidadPalette = {
  paper: '#16150F',
  paperBright: '#1D1B14',
  surface: '#211F18',
  surfaceAlt: '#26241C',
  surfacePressed: '#2E2B22',

  ink: '#F2EFE7',
  inkSoft: '#D8D4C9',
  muted: '#9A968C',
  faint: '#6B675F',
  onInk: '#16150F',

  border: '#33312A',
  borderStrong: '#45423A',

  accent: '#C9A05C',
  accentText: '#E0B878',
  accentSoft: '#2E2920',

  paleRed: { bg: '#2E1F1E', text: '#E8A6A3' },
  paleBlue: { bg: '#142A38', text: '#8FC4E8' },
  paleGreen: { bg: '#1C2A1B', text: '#9CC694' },
  paleYellow: { bg: '#2E2818', text: '#D9BE7E' },

  danger: '#E8A6A3',
  dangerBg: '#2E1F1E',
  success: '#9CC694',
  successBg: '#1C2A1B',

  shadowColor: '#000000',
  shadowOpacity: 0.4,
};

export const palettes: Record<ColorScheme, MidadPalette> = {
  light: lightColors,
  dark: darkColors,
};

/** Light palette — kept for static non-themed defaults. */
export const colors: MidadPalette = lightColors;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  pill: 9999,
} as const;

export const motion = {
  fast: 150,
  base: 250,
  slow: 400,
  // EaseOutQuint — quiet sophistication
  ease: [0.16, 1, 0.3, 1] as const,
  // Staggered reveal step
  staggerStep: 80,
} as const;

export const typeScale = {
  display: { size: 40, lineHeight: 44, letterSpacing: -0.02 },
  title: { size: 32, lineHeight: 36, letterSpacing: -0.02 },
  heading: { size: 24, lineHeight: 30, letterSpacing: -0.01 },
  subheading: { size: 18, lineHeight: 26, letterSpacing: 0 },
  body: { size: 16, lineHeight: 24, letterSpacing: 0 },
  small: { size: 14, lineHeight: 20, letterSpacing: 0 },
  caption: { size: 12, lineHeight: 16, letterSpacing: 0 },
  micro: { size: 11, lineHeight: 14, letterSpacing: 0.02 },
} as const;

export type TypeVariant = keyof typeof typeScale;

// Tag micro-typography — uppercase, wide tracking (per minimalist-ui).
export const tagType = {
  fontSize: 10,
  lineHeight: 12,
  letterSpacing: 0.05,
  textTransform: 'uppercase' as const,
};