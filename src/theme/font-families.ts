import type { FontKey } from './fonts';

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
    labelAr: 'أمشرف ثلث',
    labelEn: 'AMoshref Thulth',
    styleTagAr: 'ثلث',
    styleTagEn: 'Thuluth',
    defaultVariant: 'AMoshrefThulth',
    variants: [
      { key: 'AMoshrefThulth', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
    ],
  },
  {
    key: 'layla-thuluth',
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
    labelAr: 'مرحي',
    labelEn: 'Marhey',
    styleTagAr: 'عرضي مرح',
    styleTagEn: 'Playful Display',
    defaultVariant: 'Marhey',
    variants: [
      { key: 'Marhey', labelAr: 'عادي', labelEn: 'Regular', weight: 400 },
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
