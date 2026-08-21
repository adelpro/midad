/**
 * midad design tokens — warm ink minimalist system.
 * Palette, spacing, radii, shadows, motion, and type scale.
 * Light-first (the app is `userInterfaceStyle: "light"`).
 */

export const colors = {
  // Canvas & surfaces — warm bone / paper
  paper: '#F7F6F3', // app background (warm paper)
  paperBright: '#FBFBFA', // brighter paper
  surface: '#FFFFFF', // cards / sheets
  surfaceAlt: '#F9F9F8', // subtle surface
  surfacePressed: '#EFEEE9', // pressed surface

  // Ink — text & solids (never pure black)
  ink: '#111111', // primary text / solid CTA
  inkSoft: '#2F3437', // secondary strong text
  muted: '#787774', // secondary text
  faint: '#A9A69F', // tertiary text / disabled
  onInk: '#FFFFFF', // text on ink

  // Structural lines
  border: '#EAEAEA', // hairline borders
  borderStrong: '#D8D5CE', // stronger dividers

  // Accent — ink-saffron, used sparingly
  accent: '#B0894F',
  accentText: '#956400',
  accentSoft: '#F5EEE2', // accent tint background

  // Pale pastels (tags / semantic hints)
  paleRed: { bg: '#FDEBEC', text: '#9F2F2D' },
  paleBlue: { bg: '#E1F3FE', text: '#1F6C9F' },
  paleGreen: { bg: '#EDF3EC', text: '#346538' },
  paleYellow: { bg: '#FBF3DB', text: '#956400' },

  // Semantic
  danger: '#9F2F2D',
  dangerBg: '#FDEBEC',
  success: '#346538',
  successBg: '#EDF3EC',
} as const;

export type MidadColor = keyof typeof colors;

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

export const shadows = {
  none: undefined,
  // Ultra-diffuse, low opacity. Only used on floating surfaces.
  sheet: {
    shadowColor: '#111111',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  card: {
    shadowColor: '#111111',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
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