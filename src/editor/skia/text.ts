import { useMemo } from "react";

import {
  Skia,
  useFonts,
  vec,
  type DataModule,
  type SkParagraph,
  type SkTextStyle,
  type SkTypefaceFontProvider,
} from "@shopify/react-native-skia";

import type { MidadProject } from "@/storage/project-schema";
import { fontAssets } from "@/theme";

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
  if (typeof asset === "string") {
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
  align: "left" | "center" | "right";
  color: string;
  opacity: number;
  /**
   * Explicit wrap width (set by a horizontal resize). When null/absent the
   * width is auto: the box stretches to fit the text, capped at `maxWidth`.
   */
  wrapWidth?: number | null;
  /** Ceiling for auto width — normally the canvas width. Ignored when wrapping. */
  maxWidth: number;
  outline?: { color: string; width: number };
  /** Drop shadows behind the glyphs, painted in order (outermost first). */
  shadows?: { color: string; offsetX: number; offsetY: number; blur: number }[];
}

export interface RenderedParagraph {
  paragraph: SkParagraph;
  /**
   * The width the paragraph was shaped at, which is exactly the object's box
   * width. Painting uses this so the glyphs can never disagree with the box.
   */
  width: number;
  height: number;
}

/**
 * Probe width for auto sizing: wide enough that nothing soft-wraps, so the
 * first pass can read the text's intrinsic width.
 */
const AUTO_TEXT_WIDTH = 100000;
/** Floor for a resolved width, so an empty paragraph stays selectable. */
const MIN_TEXT_WIDTH = 1;

/** Shape a paragraph at an explicit width. */
function buildParagraph(
  spec: TextLayoutSpec,
  fonts: SkTypefaceFontProvider,
  width: number,
): SkParagraph {
  const family = spec.fontKey in fontAssets ? spec.fontKey : "Amiri";
  const isArabic = /[\u0600-\u06FF]/.test(spec.text);

  // TextAlign enum: Left=0, Right=1, Center=2, Justify=3, Start=4, End=5
  const align = spec.align === "center" ? 2 : spec.align === "right" ? 1 : 0;
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

  // Optional keys must be *absent*, not `undefined`. The native style reader
  // guards every field with `hasProperty`, which is true for a key that exists
  // and holds `undefined`, and it then converts that value as an object — which
  // throws "Value is undefined, expected an Object". Most text objects carry no
  // shadows (`shadows` is optional, and the Classic preset clears it), so
  // passing the key through unconditionally broke shaping on native. CanvasKit
  // tolerates the `undefined`, which is why this only ever failed on device.
  const style: SkTextStyle = {
    fontFamilies: [family],
    fontSize: spec.fontSize,
    heightMultiplier: spec.lineHeight > 0 ? spec.lineHeight / spec.fontSize : 1,
    color: Skia.Color(spec.color),
    fontStyle: { weight: 400 },
  };
  if (spec.shadows?.length) {
    style.shadows = spec.shadows.map((s) => ({
      color: Skia.Color(s.color),
      offset: vec(s.offsetX, s.offsetY),
      blurRadius: s.blur,
    }));
  }
  builder.pushStyle(style);
  builder.addText(spec.text);

  const paragraph = builder.build();
  paragraph.layout(width);
  return paragraph;
}

/**
 * Width a text object should lay out at.
 *
 * A manual wrap width always wins. Otherwise the text is measured unwrapped so
 * the box hugs the text exactly, then capped at the canvas so an over-long line
 * wraps at the canvas edge instead of running off it.
 *
 * The result is rounded UP: Skia truncates the layout width to an integer, so
 * shaping at a width taken straight from `getLongestLine()` (a float) collapses
 * to `floor(width)` and wraps the very line it was measured from — which showed
 * up as every auto-width text sitting on two lines inside a box that looked too
 * narrow.
 */
function resolveTextWidth(
  spec: TextLayoutSpec,
  fonts: SkTypefaceFontProvider,
): number {
  if (spec.wrapWidth != null) {
    return Math.max(MIN_TEXT_WIDTH, spec.wrapWidth);
  }
  const probe = buildParagraph(spec, fonts, AUTO_TEXT_WIDTH);
  const intrinsic = probe.getLongestLine();
  probe.dispose();
  return Math.max(
    MIN_TEXT_WIDTH,
    Math.ceil(Math.min(intrinsic, spec.maxWidth)),
  );
}

/**
 * Build a shaped, laid-out paragraph for a text object.
 *
 * The width is resolved first and the paragraph is shaped at exactly that
 * width, so `getLongestLine()` never has to stand in for the box: previously
 * the box was measured at the canvas width while the glyphs were laid out at
 * the box width, which let centred text sit off-centre and let the measured
 * height drift from the painted one.
 *
 * Callers should `paragraph.dispose()` when the render frame is done.
 */
export function layoutArabicText(
  spec: TextLayoutSpec,
  fonts: SkTypefaceFontProvider,
): RenderedParagraph | null {
  const width = resolveTextWidth(spec, fonts);
  const paragraph = buildParagraph(spec, fonts, width);
  return {
    paragraph,
    width,
    height: paragraph.getHeight(),
  };
}

/**
 * Split a laid-out paragraph into its visual lines, soft wraps included.
 *
 * Line offsets come back as UTF-16 code-unit indices. We verify that slicing
 * the source string with them reproduces the text before trusting the result;
 * when the check fails (offset units differ on some platform) we return null so
 * callers can fall back to the object's explicit newlines.
 */
export function paragraphLines(
  paragraph: SkParagraph,
  text: string,
): string[] | null {
  try {
    const metrics = paragraph.getLineMetrics();
    if (!metrics || metrics.length === 0) {
      return null;
    }
    const lines = metrics.map((m) =>
      text.slice(m.startIndex, m.endExcludingWhitespaces ?? m.endIndex),
    );
    const strip = (s: string) => s.replace(/\s+/g, "");
    if (strip(lines.join("")) !== strip(text)) {
      return null;
    }
    return lines.map((line) => line.trim()).filter((line) => line.length > 0);
  } catch {
    return null;
  }
}

/**
 * Visual line breaks for every text object in a project, keyed by object id.
 * Used by the SVG export, which cannot re-flow text on its own.
 */
export function textLineBreaks(
  project: MidadProject,
  fonts: SkTypefaceFontProvider,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const obj of project.objects) {
    if (obj.type !== "text") {
      continue;
    }
    const rendered = layoutArabicText(
      {
        text: obj.text,
        fontKey: obj.fontKey,
        fontSize: obj.fontSize,
        lineHeight: obj.lineHeight,
        align: obj.align,
        color: obj.color,
        opacity: obj.opacity,
        wrapWidth: obj.wrapWidth,
        maxWidth: project.canvas.width,
        outline: obj.outline,
      },
      fonts,
    );
    if (!rendered) {
      continue;
    }
    const lines = paragraphLines(rendered.paragraph, obj.text);
    rendered.paragraph.dispose();
    if (lines) {
      out[obj.id] = lines;
    }
  }
  return out;
}

/** Utility: extract font family list for debugging. */
export function useRegisteredFonts(
  fonts: SkTypefaceFontProvider | null,
): string[] {
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
