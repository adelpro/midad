import { useMemo } from 'react';

import { useParagraphFonts, layoutArabicText, type RenderedParagraph } from '@/editor/skia/text';
import type { CalligraphyTextObject } from '@/storage/project-schema';

export interface TextLayouts {
  [id: string]: RenderedParagraph;
}

/**
 * Layouts a shaped paragraph for every text object in the document.
 * Recomputes only when the objects or font manager change. Paragraphs are
 * disposed and rebuilt on each document change — acceptable for the editor
 * working set.
 */
export function useTextLayouts(objects: CalligraphyTextObject[], canvasWidth: number): TextLayouts {
  const fonts = useParagraphFonts();

  return useMemo(() => {
    const out: TextLayouts = {};
    if (!fonts) {
      return out;
    }
    for (const obj of objects) {
      const rendered = layoutArabicText(
        {
          text: obj.text,
          fontKey: obj.fontKey,
          fontSize: obj.fontSize,
          lineHeight: obj.lineHeight,
          align: obj.align,
          color: obj.color,
          opacity: obj.opacity,
          maxWidth: canvasWidth,
          outline: obj.outline,
        },
        fonts,
      );
      if (rendered) {
        out[obj.id] = rendered;
      }
    }
    return out;
  }, [objects, fonts, canvasWidth]);
}

/** Width/height of a laid-out text object for hit-testing. */
export function textObjectSize(layout: RenderedParagraph | undefined, fontSize: number) {
  if (layout) {
    return { width: layout.width, height: layout.height };
  }
  return { width: fontSize * 2, height: fontSize * 1.2 };
}