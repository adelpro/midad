import { useEffect, useMemo, useRef } from "react";

import {
  layoutArabicText,
  useParagraphFonts,
  type RenderedParagraph,
} from "@/editor/skia/text";
import type { CalligraphyTextObject } from "@/storage/project-schema";

export interface TextLayouts {
  [id: string]: RenderedParagraph;
}

/** Stable identity for the "fonts not loaded yet" case. */
const EMPTY_LAYOUTS: TextLayouts = {};

/**
 * Every field that changes how glyphs are shaped, joined, wrapped or painted.
 *
 * Deliberately EXCLUDES `transform`, `zIndex` and `opacity`: moving, scaling or
 * fading an object cannot alter its shaping, so those edits must never trigger a
 * rebuild. This is what keeps dragging cheap once a design holds many small text
 * objects (e.g. a word split into per-cluster parts).
 */
function layoutSignature(
  objects: CalligraphyTextObject[],
  canvasWidth: number,
): string {
  let signature = String(canvasWidth);
  for (const obj of objects) {
    const outline = obj.outline
      ? `${obj.outline.color}:${obj.outline.width}`
      : "";
    const shadows = obj.shadows
      ? obj.shadows
          .map((s) => `${s.color}:${s.offsetX}:${s.offsetY}:${s.blur}`)
          .join(",")
      : "";
    signature +=
      "\u0000" +
      [
        obj.id,
        obj.text,
        obj.fontKey,
        obj.fontSize,
        obj.lineHeight,
        obj.align,
        obj.wrapWidth ?? "",
        obj.color,
        outline,
        shadows,
      ].join("\u0001");
  }
  return signature;
}

/**
 * Lays out a shaped paragraph per text object, keyed on the objects' *layout*
 * signature rather than their array identity.
 *
 * Because the memo depends on the signature, a gesture that only moves or scales
 * objects leaves the returned map referentially identical — no shaping, and no
 * downstream re-memo in `EditorCanvas`. Paragraphs are native handles, so the
 * previous set is disposed once the new one has been committed.
 */
export function useTextLayouts(
  objects: CalligraphyTextObject[],
  canvasWidth: number,
): TextLayouts {
  const fonts = useParagraphFonts();

  const signature = useMemo(
    () => layoutSignature(objects, canvasWidth),
    [objects, canvasWidth],
  );

  const layouts = useMemo(() => {
    if (!fonts) {
      return EMPTY_LAYOUTS;
    }
    const out: TextLayouts = {};
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
          // An explicit wrap width (set by a horizontal resize) re-flows the
          // glyphs; otherwise the box stretches to the text, capped at the
          // canvas width.
          wrapWidth: obj.wrapWidth,
          maxWidth: canvasWidth,
          outline: obj.outline,
          shadows: obj.shadows,
        },
        fonts,
      );
      if (rendered) {
        out[obj.id] = rendered;
      }
    }
    return out;
    // Only the layout signature is a dependency: `objects` is read from this
    // render's closure, and any change to a layout-relevant field changes the
    // signature, so the memo still sees the latest values. Depending on the
    // array identity instead would re-shape every paragraph on every frame of a
    // drag, since a transform patch produces a new array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, fonts, canvasWidth]);

  // Dispose the paragraphs of the previous layout set once the new one is on
  // screen. Safe because a re-layout rebuilds every paragraph, so nothing in the
  // old set is referenced by the new one.
  const previousRef = useRef<TextLayouts | null>(null);
  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = layouts;
    if (!previous || previous === layouts) {
      return;
    }
    for (const id in previous) {
      previous[id]?.paragraph.dispose();
    }
  }, [layouts]);

  // Dispose whatever is still live when the editor unmounts.
  useEffect(
    () => () => {
      const current = previousRef.current;
      if (!current) {
        return;
      }
      for (const id in current) {
        current[id]?.paragraph.dispose();
      }
      previousRef.current = null;
    },
    [],
  );

  return layouts;
}

/**
 * Width/height of a laid-out text object for hit-testing. The layout already
 * carries the resolved box width (hugged, wrapped, or capped), so it is used
 * as-is; the fallbacks only apply before fonts have loaded.
 */
export function textObjectSize(
  layout: RenderedParagraph | undefined,
  fontSize: number,
  wrapWidth?: number | null,
) {
  return {
    width: layout?.width ?? wrapWidth ?? fontSize * 2,
    height: layout?.height ?? fontSize * 1.2,
  };
}
