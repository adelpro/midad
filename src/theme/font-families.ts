import type { FontKey } from './fonts';

/**
 * The scripts a bundled face can cover. Drives the picker's specimen text, its
 * sectioning, and whether a word in that face can be split into movable parts.
 */
export type FontScript = 'arabic' | 'latin';

/** One pickable face: a keyed asset plus its weight and localized name. */
export interface FontVariant {
  key: FontKey;
  labelAr: string;
  labelEn: string;
  /** Static weight the file ships. 400 for single-weight faces. */
  weight: number;
}

/**
 * A typeface family: one or more weight variants sharing a name and style.
 *
 * Grouping is by typeface (not by script style): "the same font, different
 * styles", which is how the picker presents them. The style tag is the
 * calligraphic label shown beneath the specimen.
 */
export interface FontFamily {
  key: string;
  /**
   * Required, not optional. An absent tag silently falls back to an Arabic
   * specimen and section, which is the silent-wrong-face class this registry
   * exists to avoid — so the compiler should catch the omission instead.
   */
  script: FontScript;
  labelAr: string;
  labelEn: string;
  styleTagAr: string;
  styleTagEn: string;
  /** The variant selected when the family is first chosen. */
  defaultVariant: FontKey;
  variants: readonly FontVariant[];
}

export const fontFamilies: readonly FontFamily[] = [
  {
    key: 'amiri',
    script: 'arabic',
    labelAr: 'أميري',
    labelEn: 'Amiri',
    styleTagAr: 'نسخ',
    styleTagEn: 'Naskh',
    defaultVariant: 'Amiri',
    variants: [
      { key: 'Amiri', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
      { key: 'Amiri-Bold', labelAr: 'عريض', labelEn: 'Bold', weight: 700 },
    ],
  },
  {
    key: 'amiri-quran',
    script: 'arabic',
    labelAr: 'أميري قرآن',
    labelEn: 'Amiri Quran',
    styleTagAr: 'قرآن',
    styleTagEn: 'Quran',
    defaultVariant: 'AmiriQuran',
    variants: [
      { key: 'AmiriQuran', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'lateef',
    script: 'arabic',
    labelAr: 'لطيف',
    labelEn: 'Lateef',
    styleTagAr: 'نسخ تقليدي',
    styleTagEn: 'Traditional Naskh',
    defaultVariant: 'Lateef',
    variants: [
      { key: 'Lateef', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
      { key: 'Lateef-Bold', labelAr: 'عريض', labelEn: 'Bold', weight: 700 },
    ],
  },
  {
    key: 'noto-naskh',
    script: 'arabic',
    labelAr: 'نوتو نسخ',
    labelEn: 'Noto Naskh',
    styleTagAr: 'نسخ محايد',
    styleTagEn: 'Neutral Naskh',
    defaultVariant: 'NotoNaskhArabic',
    variants: [
      {
        key: 'NotoNaskhArabic',
        labelAr: 'عادي',
        labelEn: 'Regular',
        weight: 400,
      },
      {
        key: 'NotoNaskhArabic-Bold',
        labelAr: 'عريض',
        labelEn: 'Bold',
        weight: 700,
      },
    ],
  },
  {
    key: 'aref-ruqaa',
    script: 'arabic',
    labelAr: 'عارف رقعة',
    labelEn: 'Aref Ruqaa',
    styleTagAr: 'رقعة',
    styleTagEn: "Ruq'a",
    defaultVariant: 'ArefRuqaa',
    variants: [
      { key: 'ArefRuqaa', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
      {
        key: 'ArefRuqaa-Bold',
        labelAr: 'عريض',
        labelEn: 'Bold',
        weight: 700,
      },
    ],
  },
  {
    key: 'rakkas',
    script: 'arabic',
    labelAr: 'ركّاس',
    labelEn: 'Rakkas',
    styleTagAr: 'رقعة عرضية',
    styleTagEn: "Ruq'a Display",
    defaultVariant: 'Rakkas',
    variants: [
      { key: 'Rakkas', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'reem-kufi',
    script: 'arabic',
    labelAr: 'ريم كوفي',
    labelEn: 'Reem Kufi',
    styleTagAr: 'كوفي حديث',
    styleTagEn: 'Modern Kufi',
    defaultVariant: 'ReemKufi',
    variants: [
      { key: 'ReemKufi', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
      { key: 'ReemKufi-Bold', labelAr: 'عريض', labelEn: 'Bold', weight: 700 },
    ],
  },
  {
    key: 'noto-kufi',
    script: 'arabic',
    labelAr: 'نوتو كوفي',
    labelEn: 'Noto Kufi',
    styleTagAr: 'كوفي',
    styleTagEn: 'Kufi',
    defaultVariant: 'NotoKufiArabic',
    variants: [
      {
        key: 'NotoKufiArabic',
        labelAr: 'عادي',
        labelEn: 'Regular',
        weight: 400,
      },
      {
        key: 'NotoKufiArabic-Bold',
        labelAr: 'عريض',
        labelEn: 'Bold',
        weight: 700,
      },
    ],
  },
  {
    key: 'qahiri',
    script: 'arabic',
    labelAr: 'قاهري',
    labelEn: 'Qahiri',
    styleTagAr: 'كوفي قديم',
    styleTagEn: 'Antique Kufic',
    defaultVariant: 'Qahiri',
    variants: [
      { key: 'Qahiri', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'katibeh',
    script: 'arabic',
    labelAr: 'كاتبة',
    labelEn: 'Katibeh',
    styleTagAr: 'ثلث',
    styleTagEn: 'Thuluth',
    defaultVariant: 'Katibeh',
    variants: [
      { key: 'Katibeh', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'jomhuria',
    script: 'arabic',
    labelAr: 'جمهورية',
    labelEn: 'Jomhuria',
    styleTagAr: 'ثلث عرضي',
    styleTagEn: 'Thuluth Display',
    defaultVariant: 'Jomhuria',
    variants: [
      { key: 'Jomhuria', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'lemonada',
    script: 'arabic',
    labelAr: 'ليمونادة',
    labelEn: 'Lemonada',
    styleTagAr: 'عرض حديث',
    styleTagEn: 'Modern Display',
    defaultVariant: 'Lemonada',
    variants: [
      { key: 'Lemonada', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
      { key: 'Lemonada-Bold', labelAr: 'عريض', labelEn: 'Bold', weight: 700 },
    ],
  },
  {
    key: 'vibes',
    script: 'arabic',
    labelAr: 'فايبس',
    labelEn: 'Vibes',
    styleTagAr: 'زخرفي',
    styleTagEn: 'Ornamental',
    defaultVariant: 'Vibes',
    variants: [
      { key: 'Vibes', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'bouazzi-maghribi',
    script: 'arabic',
    labelAr: 'بوزي مغربي',
    labelEn: 'Bouazzi Maghribi',
    styleTagAr: 'مغربي',
    styleTagEn: 'Maghribi',
    defaultVariant: 'BouazziMaghribi',
    variants: [
      {
        key: 'BouazziMaghribi',
        labelAr: 'عادي',
        labelEn: 'Regular',
        weight: 400,
      },
    ],
  },
  {
    key: 'amoshref-thulth',
    script: 'arabic',
    labelAr: 'أمشرف ثلث',
    labelEn: 'AMoshref Thulth',
    styleTagAr: 'ثلث',
    styleTagEn: 'Thuluth',
    defaultVariant: 'AMoshrefThulth',
    variants: [
      {
        key: 'AMoshrefThulth',
        labelAr: 'عادي',
        labelEn: 'Regular',
        weight: 400,
      },
    ],
  },
  {
    key: 'layla-thuluth',
    script: 'arabic',
    labelAr: 'ليلى الثلث',
    labelEn: 'Layla Thuluth',
    styleTagAr: 'ثلث تقليدي',
    styleTagEn: 'Traditional Thuluth',
    defaultVariant: 'LaylaThuluth',
    variants: [
      { key: 'LaylaThuluth', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'gulzar',
    script: 'arabic',
    labelAr: 'گلزار',
    labelEn: 'Gulzar',
    styleTagAr: 'نستعليق',
    styleTagEn: 'Nastaliq',
    defaultVariant: 'Gulzar',
    variants: [
      { key: 'Gulzar', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'kufam',
    script: 'arabic',
    labelAr: 'كوفام',
    labelEn: 'Kufam',
    styleTagAr: 'كوفي هندسي',
    styleTagEn: 'Geometric Kufi',
    defaultVariant: 'Kufam',
    variants: [
      { key: 'Kufam', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'scheherazade-new',
    script: 'arabic',
    labelAr: 'شهرزاد الجديد',
    labelEn: 'Scheherazade New',
    styleTagAr: 'نسخ قرآني',
    styleTagEn: 'Quranic Naskh',
    defaultVariant: 'ScheherazadeNew',
    variants: [
      {
        key: 'ScheherazadeNew',
        labelAr: 'عادي',
        labelEn: 'Regular',
        weight: 400,
      },
      {
        key: 'ScheherazadeNew-Bold',
        labelAr: 'عريض',
        labelEn: 'Bold',
        weight: 700,
      },
    ],
  },
  {
    key: 'mirza',
    script: 'arabic',
    labelAr: 'ميرزا',
    labelEn: 'Mirza',
    styleTagAr: 'فارسي',
    styleTagEn: 'Persian',
    defaultVariant: 'Mirza',
    variants: [
      { key: 'Mirza', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
      { key: 'Mirza-Bold', labelAr: 'عريض', labelEn: 'Bold', weight: 700 },
    ],
  },
  {
    key: 'el-messiri',
    script: 'arabic',
    labelAr: 'المصيري',
    labelEn: 'El Messiri',
    styleTagAr: 'عرضي أنيق',
    styleTagEn: 'Elegant Display',
    defaultVariant: 'ElMessiri',
    variants: [
      { key: 'ElMessiri', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'marhey',
    script: 'arabic',
    labelAr: 'مرحي',
    labelEn: 'Marhey',
    styleTagAr: 'عرضي مرح',
    styleTagEn: 'Playful Display',
    defaultVariant: 'Marhey',
    variants: [
      { key: 'Marhey', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },

  // ── Latin ─────────────────────────────────────────────────────────────────
  // Calligraphic Latin faces. `script: 'latin'` is what stops the picker's
  // Arabic specimen, puts them in their own section, and makes
  // `familySupportsSplit` refuse — see docs/editor-split-and-rejoin.md §2.
  {
    key: 'pinyon-script',
    script: 'latin',
    labelAr: 'بينيون سكريبت',
    labelEn: 'Pinyon Script',
    styleTagAr: 'مخطوطة رسمية',
    styleTagEn: 'Formal Script',
    defaultVariant: 'PinyonScript',
    variants: [
      { key: 'PinyonScript', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'great-vibes',
    script: 'latin',
    labelAr: 'غريت فايبس',
    labelEn: 'Great Vibes',
    styleTagAr: 'مخطوطة أنيقة',
    styleTagEn: 'Elegant Script',
    defaultVariant: 'GreatVibes',
    variants: [
      { key: 'GreatVibes', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'allura',
    script: 'latin',
    labelAr: 'ألورا',
    labelEn: 'Allura',
    styleTagAr: 'مخطوطة انسيابية',
    styleTagEn: 'Flowing Script',
    defaultVariant: 'Allura',
    variants: [
      { key: 'Allura', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'tangerine',
    script: 'latin',
    labelAr: 'تانجرين',
    labelEn: 'Tangerine',
    styleTagAr: 'مخطوطة خفيفة',
    styleTagEn: 'Light Script',
    defaultVariant: 'Tangerine',
    variants: [
      { key: 'Tangerine', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'parisienne',
    script: 'latin',
    labelAr: 'باريزيان',
    labelEn: 'Parisienne',
    styleTagAr: 'مخطوطة عصرية',
    styleTagEn: 'Modern Script',
    defaultVariant: 'Parisienne',
    variants: [
      { key: 'Parisienne', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'yellowtail',
    script: 'latin',
    labelAr: 'يلوتيل',
    labelEn: 'Yellowtail',
    styleTagAr: 'فرشاة',
    styleTagEn: 'Brush Script',
    defaultVariant: 'Yellowtail',
    variants: [
      { key: 'Yellowtail', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'sacramento',
    script: 'latin',
    labelAr: 'ساكرامنتو',
    labelEn: 'Sacramento',
    styleTagAr: 'فرشاة أنيقة',
    styleTagEn: 'Elegant Brush',
    defaultVariant: 'Sacramento',
    variants: [
      { key: 'Sacramento', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'dancing-script',
    script: 'latin',
    labelAr: 'دانسينغ سكريبت',
    labelEn: 'Dancing Script',
    styleTagAr: 'خط يدوي',
    styleTagEn: 'Handwritten',
    defaultVariant: 'DancingScript',
    variants: [
      {
        key: 'DancingScript',
        labelAr: 'عادي',
        labelEn: 'Regular',
        weight: 400,
      },
      {
        key: 'DancingScript-Bold',
        labelAr: 'عريض',
        labelEn: 'Bold',
        weight: 700,
      },
    ],
  },
  {
    key: 'pacifico',
    script: 'latin',
    labelAr: 'باسيفيكو',
    labelEn: 'Pacifico',
    styleTagAr: 'فرشاة عريضة',
    styleTagEn: 'Wide Brush',
    defaultVariant: 'Pacifico',
    variants: [
      { key: 'Pacifico', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'eb-garamond',
    script: 'latin',
    labelAr: 'إي بي غاراموند',
    labelEn: 'EB Garamond',
    styleTagAr: 'سيريف عتيق',
    styleTagEn: 'Old-Style Serif',
    defaultVariant: 'EBGaramond',
    variants: [
      { key: 'EBGaramond', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
      { key: 'EBGaramond-Bold', labelAr: 'عريض', labelEn: 'Bold', weight: 700 },
    ],
  },
];

const familyByVariant = new Map<string, FontFamily>();
for (const family of fontFamilies) {
  for (const variant of family.variants) {
    familyByVariant.set(variant.key, family);
  }
}

/** The family a stored `fontKey` belongs to, or undefined for an unknown key. */
export function familyForVariant(fontKey: string): FontFamily | undefined {
  return familyByVariant.get(fontKey);
}

/** The variant record for a stored `fontKey`, or undefined. */
export function variantFor(fontKey: string): FontVariant | undefined {
  const family = familyForVariant(fontKey);
  return family?.variants.find((v) => v.key === fontKey);
}

/**
 * The variant a family declares as its default. A key the registry does not
 * know (a legacy or removed face) falls back to stripping the `-Bold` suffix —
 * how the old Classic preset un-bolded a face the registry never listed.
 */
export function defaultVariantForKey(fontKey: string): string {
  return (
    familyForVariant(fontKey)?.defaultVariant ?? fontKey.replace(/-Bold$/, '')
  );
}

/**
 * Whether a face's script supports splitting a word into movable parts.
 *
 * False only for a known Latin family: Latin clusters are not connected runs,
 * so per-cluster splitting severs the ligatures and kerning the typeface is
 * built on. Unknown and remote keys return true — a remote font declares its
 * own coverage in `subsets`, and refusing one we cannot classify would be a
 * regression against today's behaviour.
 *
 * See `docs/editor-split-and-rejoin.md` §2 for the joining argument this
 * qualifies.
 */
export function familySupportsSplit(fontKey: string): boolean {
  return familyForVariant(fontKey)?.script !== 'latin';
}
