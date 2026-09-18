import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  layoutArabicText,
  useParagraphFonts,
  type RenderedParagraph,
} from '@/editor/skia/text';
import type { CalligraphyTextObject } from '@/storage/project-schema';

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
    const shadows = obj.shadows
      ? obj.shadows
          .map((s) => `${s.color}:${s.offsetX}:${s.offsetY}:${s.blur}`)
          .join(',')
      : '';
    signature +=
      '\u0000' +
      [
        obj.id,
        obj.text,
        obj.fontKey,
        obj.fontSize,
        obj.lineHeight,
        obj.align,
        obj.wrapWidth ?? '',
        obj.color,
        shadows,
      ].join('\u0001');
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

  /**
   * Replaced generations awaiting disposal. Paragraphs are native handles, so
   * they must be freed — but *when* they are freed matters, see below.
   */
  const previousRef = useRef<TextLayouts | null>(null);
  const pendingRef = useRef<TextLayouts[]>([]);

  /** Frees every queued generation. Safe to call with an empty queue. */
  const flushPending = useCallback(() => {
    for (const generation of pendingRef.current.splice(0)) {
      for (const id in generation) {
        generation[id]?.paragraph.dispose();
      }
    }
  }, []);

  // Dispose the paragraphs of the previous layout set once the new one is on
  // screen. Nothing in the old set is shared with the new one, so the only
  // question is *when* — and disposing synchronously in this effect is too
  // early.
  //
  // Skia's renderer draws on its own frame loop, so a paragraph freed in this
  // commit's effect can still be handed to CanvasKit by a frame that is already
  // in flight:
  //   "Cannot pass deleted object as a pointer of type Paragraph*"
  // That is not a one-off either: an exception thrown mid-draw leaves the failed
  // command in Skia's retained queue, so the same stale paragraph is retried on
  // every subsequent frame and the log floods.
  //
  // A single stepper tap rarely wins that race. A drag re-lays out on every
  // frame — exactly what the font-size gauge does — and hits it reliably, so the
  // wait has to clear a *whole* frame: the first animation frame lets Skia draw
  // the generations that replaced these, the second frees them once that draw
  // has certainly happened. Retention stays bounded at ~two frames' worth.
  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = layouts;
    if (previous && previous !== layouts) {
      pendingRef.current.push(previous);
    }
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(flushPending);
    });
    // Cancelling is harmless: it drops the queued callbacks, not the generations
    // themselves, so the next flush still frees everything.
    return () => {
      cancelAnimationFrame(outer);
      if (inner) {
        cancelAnimationFrame(inner);
      }
    };
  }, [layouts, flushPending]);
  // Dispose whatever is still live when the editor unmounts.
  useEffect(
    () => () => {
      flushPending();
      const current = previousRef.current;
      if (!current) {
        return;
      }
      for (const id in current) {
        current[id]?.paragraph.dispose();
      }
      previousRef.current = null;
    },
    [flushPending],
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
