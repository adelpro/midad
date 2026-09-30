/**
 * Font registry for midad.
 *
 * Each key is the fontFamily name used by React Native `fontFamily` and by
 * Skia's `TypefaceFontProvider`. The value is the bundled asset.
 *
 * The registry is split in two, because the first screen needs almost none of
 * it (see `docs/editor-font-loading.md`):
 *
 *  - `coreFontAssets` — the eight faces the first screen draws: the Arabic UI
 *    sans (Cairo), the Latin UI sans (Geist), and the display face every first
 *    screen reaches through `fontRoles.display` / `displayBold` (Amiri). Only
 *    these gate the splash.
 *  - `displayFontAssets` — the twenty-nine calligraphic faces. Nothing on the
 *    first screen draws them, so they load on demand: opening a design ensures
 *    the faces its own text objects name, and the font picker warms the rest in
 *    the background.
 *
 * `fontAssets` stays their union, so `FontKey`, `font-families.ts`, the picker
 * and the SVG exporter keep their current shape.
 *
 * Families:
 *  - Cairo            → Arabic UI sans (400/700)              [core]
 *  - Amiri            → Naskh display/calligraphy (400/700)   [core]
 *  - Geist            → Latin UI sans (400/500/600/700)       [core]
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
 *  - AMoshrefThulth   → Thuluth calligraphic (400)
 *  - LaylaThuluth     → Traditional Thuluth (400)
 *  - Gulzar           → Urdu Nastaliq (400)
 *  - Kufam            → Geometric Kufi, variable pinned to 400
 *  - ScheherazadeNew  → Quranic Naskh (400/700)
 *  - Mirza            → Persian text (400/700)
 *  - ElMessiri        → Elegant display, variable pinned to 400
 *  - Marhey           → Playful display (400)
 */

/** The eager set: the only faces that gate the splash. */
export const coreFontAssets = {
  Cairo: require('@/assets/fonts/cairo-arabic-400.ttf'),
  'Cairo-Bold': require('@/assets/fonts/cairo-arabic-700.ttf'),
  Amiri: require('@/assets/fonts/amiri-arabic-400.ttf'),
  'Amiri-Bold': require('@/assets/fonts/amiri-arabic-700.ttf'),
  Geist: require('@/assets/fonts/geist-latin-400.ttf'),
  'Geist-Medium': require('@/assets/fonts/geist-latin-500.ttf'),
  'Geist-SemiBold': require('@/assets/fonts/geist-latin-600.ttf'),
  'Geist-Bold': require('@/assets/fonts/geist-latin-700.ttf'),
} as const;

/** The lazy set: loaded on demand, never before the first screen. */
export const displayFontAssets = {
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
  Lateef: require('@/assets/fonts/lateef-arabic-400.ttf'),
  'Lateef-Bold': require('@/assets/fonts/lateef-arabic-700.ttf'),
  Rakkas: require('@/assets/fonts/rakkas-arabic-400.ttf'),
  Qahiri: require('@/assets/fonts/qahiri-arabic-400.ttf'),
  Katibeh: require('@/assets/fonts/katibeh-arabic-400.ttf'),
  Jomhuria: require('@/assets/fonts/jomhuria-arabic-400.ttf'),
  Vibes: require('@/assets/fonts/vibes-arabic-400.ttf'),
  AmiriQuran: require('@/assets/fonts/amiri-quran-arabic-400.ttf'),
  BouazziMaghribi: require('@/assets/fonts/bouazzi-maghribi-400.ttf'),
  AMoshrefThulth: require('@/assets/fonts/amoshref-thulth-arabic-400.ttf'),
  LaylaThuluth: require('@/assets/fonts/layla-thuluth-arabic-400.ttf'),
  Gulzar: require('@/assets/fonts/gulzar-arabic-400.ttf'),
  // Kufam and ElMessiri ship upstream as variable fonts; the editor pins
  // weight 400, so only each file's default instance is used. Marhey was
  // instanced to a static weight 400 (its upstream default is Light).
  Kufam: require('@/assets/fonts/kufam-arabic-400.ttf'),
  ScheherazadeNew: require('@/assets/fonts/scheherazade-new-arabic-400.ttf'),
  'ScheherazadeNew-Bold': require('@/assets/fonts/scheherazade-new-arabic-700.ttf'),
  Mirza: require('@/assets/fonts/mirza-arabic-400.ttf'),
  'Mirza-Bold': require('@/assets/fonts/mirza-arabic-700.ttf'),
  ElMessiri: require('@/assets/fonts/el-messiri-arabic-400.ttf'),
  Marhey: require('@/assets/fonts/marhey-arabic-400.ttf'),
} as const;

export const fontAssets = {
  ...coreFontAssets,
  ...displayFontAssets,
} as const;

export type FontKey = keyof typeof fontAssets;

/** The bundled display faces, as a set — the lazy half of the split. */
export const displayFontKeys: ReadonlySet<string> = new Set(
  Object.keys(displayFontAssets),
);

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

export { familyForVariant, fontFamilies, variantFor } from './font-families';
export type { FontFamily, FontVariant } from './font-families';
