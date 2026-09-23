/**
 * Font registry for midad.
 *
 * Each key is the fontFamily name used by React Native `fontFamily` and by
 * Skia's `TypefaceFontProvider`. The value is the bundled asset.
 *
 * Families:
 *  - Cairo            → Arabic UI sans (400/700)
 *  - Amiri            → Naskh display/calligraphy (400/700)
 *  - ArefRuqaa        → Ruq'a calligraphic (400/700)
 *  - NotoNaskhArabic  → Naskh body (400/700)
 *  - NotoKufiArabic   → Kufi (400/700)
 *  - ReemKufi         → Modern Kufi (400/700)
 *  - Lemonada         → Modern display (400/700)
 *  - Lateef           → Traditional Naskh (400/700)
 *  - Rakkas           → Ruq'a display (400)
 *  - Qahiri           → Antique Kufic (400)
 *  - Katibeh          → Thuluth-inspired (400)
 *  - Jomhuria         → Thuluth display (400)
 *  - Vibes            → Ornamental display (400)
 *  - AmiriQuran       → Quranic Naskh (400)
 *  - BouazziMaghribi  → Maghribi (400)
 *  - Geist            → Latin UI sans (400/500/600/700)
 */

export const fontAssets = {
  Cairo: require('@/assets/fonts/cairo-arabic-400.ttf'),
  'Cairo-Bold': require('@/assets/fonts/cairo-arabic-700.ttf'),
  Amiri: require('@/assets/fonts/amiri-arabic-400.ttf'),
  'Amiri-Bold': require('@/assets/fonts/amiri-arabic-700.ttf'),
  ArefRuqaa: require('@/assets/fonts/aref-ruqaa-arabic-400.ttf'),
  'ArefRuqaa-Bold': require('@/assets/fonts/aref-ruqaa-arabic-700.ttf'),
  NotoNaskhArabic: require('@/assets/fonts/noto-naskh-arabic-400.ttf'),
  'NotoNaskhArabic-Bold': require('@/assets/fonts/noto-naskh-arabic-700.ttf'),
  NotoKufiArabic: require('@/assets/fonts/noto-kufi-arabic-400.ttf'),
  'NotoKufiArabic-Bold': require('@/assets/fonts/noto-kufi-arabic-700.ttf'),
  ReemKufi: require('@/assets/fonts/reem-kufi-arabic-400.ttf'),
  'ReemKufi-Bold': require('@/assets/fonts/reem-kufi-arabic-700.ttf'),
  Lemonada: require('@/assets/fonts/lemonada-arabic-400.ttf'),
  'Lemonada-Bold': require('@/assets/fonts/lemonada-arabic-700.ttf'),
  Geist: require('@/assets/fonts/geist-latin-400.ttf'),
  'Geist-Medium': require('@/assets/fonts/geist-latin-500.ttf'),
  'Geist-SemiBold': require('@/assets/fonts/geist-latin-600.ttf'),
  'Geist-Bold': require('@/assets/fonts/geist-latin-700.ttf'),
  Lateef: require('@/assets/fonts/lateef-arabic-400.ttf'),
  'Lateef-Bold': require('@/assets/fonts/lateef-arabic-700.ttf'),
  Rakkas: require('@/assets/fonts/rakkas-arabic-400.ttf'),
  Qahiri: require('@/assets/fonts/qahiri-arabic-400.ttf'),
  Katibeh: require('@/assets/fonts/katibeh-arabic-400.ttf'),
  Jomhuria: require('@/assets/fonts/jomhuria-arabic-400.ttf'),
  Vibes: require('@/assets/fonts/vibes-arabic-400.ttf'),
  AmiriQuran: require('@/assets/fonts/amiri-quran-arabic-400.ttf'),
  BouazziMaghribi: require('@/assets/fonts/bouazzi-maghribi-400.ttf'),
} as const;

export type FontKey = keyof typeof fontAssets;

/**
 * Semantic font roles. Choose based on the current UI language so the app
 * switches cleanly between Arabic (RTL) and English (LTR).
 */
export interface FontRoles {
  /** Primary UI font (buttons, body, inputs) */
  ui: string;
  /** Bold UI weight */
  uiBold: string;
  /** Medium UI weight */
  uiMedium: string;
  /** Semi-bold UI weight */
  uiSemibold: string;
  /** Display/calligraphic font for headings & brand */
  display: string;
  /** Display bold weight */
  displayBold: string;
  /** Monospace for metadata/keystrokes */
  mono: string;
}

export const fontRoles: { ar: FontRoles; en: FontRoles } = {
  ar: {
    ui: 'Cairo',
    uiBold: 'Cairo-Bold',
    uiMedium: 'Cairo',
    uiSemibold: 'Cairo-Bold',
    display: 'Amiri',
    displayBold: 'Amiri-Bold',
    mono: 'monospace',
  },
  en: {
    ui: 'Geist',
    uiBold: 'Geist-Bold',
    uiMedium: 'Geist-Medium',
    uiSemibold: 'Geist-SemiBold',
    display: 'Amiri',
    displayBold: 'Amiri-Bold',
    mono: 'monospace',
  },
};

export {
  familyForVariant,
  fontFamilies,
  variantFor,
} from './font-families';
export type { FontFamily, FontVariant } from './font-families';
