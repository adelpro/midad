import { useMemo } from 'react';

import {
  Skia,
  useFonts,
  type DataModule,
  type SkParagraph,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';

import { fontAssets } from '@/theme';

/**
 * Arabic text rendering via the Skia Paragraph API.
 *
 * The ParagraphBuilder uses HarfBuzz shaping, so Arabic renders with correct
 * contextual forms (initial/medial/final), lam-alef ligatures, and RTL
 * direction. The simple Skia `<Text>` component does NOT shape Arabic, so this
 * is the only correct path.
 */

/**
 * Normalize a Metro font asset for Skia's useFonts.
 * On native, require() returns a numeric asset id (RNModule). On web it
 * resolves to a URI string, which Skia's resolveAsset cannot handle directly —
 * wrap it in a { uri } asset object (MetroAsset shape).
 */
function toFontSource(asset: unknown): DataModule {
  if (typeof asset === 'string') {
    return { uri: asset, width: 0, height: 0 };
  }
  return asset as DataModule;
}

/** Loads a typeface provider usable by ParagraphBuilder. */
export function useParagraphFonts(): SkTypefaceFontProvider | null {
  // Skia's useFonts expects each family to map to an *array* of sources.
  const sources = Object.fromEntries(
    Object.entries(fontAssets).map(([family, asset]) => [
      family,
      [toFontSource(asset)],
    ]),
  );
  return useFonts(sources);
}

export interface TextLayoutSpec {
  text: string;
  fontKey: string; // family name as registered (e.g. 'Amiri')
  fontSize: number;
  lineHeight: number;
  align: 'left' | 'center' | 'right';
  color: string;
  opacity: number;
  maxWidth: number;
  outline?: { color: string; width: number };
}

export interface RenderedParagraph {
  paragraph: SkParagraph;
  width: number;
  height: number;
}

/**
 * Build a shaped, laid-out paragraph for a text object.
 * Callers should `paragraph.dispose()` when the render frame is done.
 */
export function layoutArabicText(spec: TextLayoutSpec, fonts: SkTypefaceFontProvider): RenderedParagraph | null {
  const family = spec.fontKey in fontAssets ? spec.fontKey : 'Amiri';
  const isArabic = /[\u0600-\u06FF]/.test(spec.text);

  // TextAlign enum: Left=0, Right=1, Center=2, Justify=3, Start=4, End=5
  const align = spec.align === 'center' ? 2 : spec.align === 'right' ? 1 : 0;
  // TextDirection enum: RTL=0, LTR=1
  const direction = isArabic ? 0 : 1;

  // The typeface provider is mandatory on web (no system font manager) and
  // guarantees the bundled calligraphy fonts are used on native as well.
  const builder = Skia.ParagraphBuilder.Make(
    {
      textAlign: align,
      textDirection: direction,
    },
    fonts,
  );

  const style = {
    fontFamilies: [family],
    fontSize: spec.fontSize,
    heightMultiplier: spec.lineHeight > 0 ? spec.lineHeight / spec.fontSize : 1,
    color: Skia.Color(spec.color),
    fontStyle: { weight: 400 },
  };

  builder.pushStyle(style);
  builder.addText(spec.text);

  const paragraph = builder.build();
  paragraph.layout(spec.maxWidth);

  return {
    paragraph,
    width: paragraph.getLongestLine(),
    height: paragraph.getHeight(),
  };
}

/** Utility: extract font family list for debugging. */
export function useRegisteredFonts(fonts: SkTypefaceFontProvider | null): string[] {
  return useMemo(() => {
    if (!fonts) {
      return [];
    }
    try {
      const mgr = fonts as unknown as { getFamilies?: () => string[] };
      return mgr.getFamilies ? mgr.getFamilies() : Object.keys(fontAssets);
    } catch {
      return Object.keys(fontAssets);
    }
  }, [fonts]);
}