import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';

import { layoutArabicText, type TextLayoutSpec } from '@/editor/skia/text';
import { segmentClusters } from '@/editor/text/clusters';
import type { CalligraphyTextObject } from '@/storage/project-schema';

/** Why a text object could not be turned into parts. */
export type SplitFailure =
  /** Fewer than two connected clusters — nothing to separate. */
  | 'too-few-clusters'
  /** Already a part of a split word. */
  | 'already-a-part'
  /** A cluster soft-wrapped across lines, so it cannot stand alone. */
  | 'cluster-wrapped'
  /** The paragraph could not be laid out (fonts missing). */
  | 'layout-failed';

export type SplitOutcome =
  | { ok: true; parts: CalligraphyTextObject[] }
  | { ok: false; reason: SplitFailure };

/** Generates ids for the produced parts, matching the editor's text-id convention. */
function makePartId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function specFor(
  source: CalligraphyTextObject,
  text: string,
  wrapWidth: number | null | undefined,
  maxWidth: number,
): TextLayoutSpec {
  return {
    text,
    fontKey: source.fontKey,
    fontSize: source.fontSize,
    lineHeight: source.lineHeight,
    align: source.align,
    color: source.color,
    opacity: source.opacity,
    wrapWidth,
    maxWidth,
    outline: source.outline,
    shadows: source.shadows,
  };
}

/**
 * Break a text object into one object per connected glyph cluster.
 *
 * Each cluster is shaped on its own, which reproduces the original glyph forms
 * exactly: the first letter of a connected run is always in initial form and the
 * last in final form, which is what the shaper picks for the same run in
 * isolation. See `clusters.ts`.
 *
 * Placement is derived by *measuring twice*: the cluster's tight ink rect inside
 * the original paragraph, and the same cluster's tight ink rect in its own
 * standalone paragraph. Subtracting the two centres gives the offset that lands
 * the part exactly where the ink already was. Because both measurements use the
 * same rect conventions, the difference cancels glyph bearings, line-box height
 * bias and text-alignment rounding — so splitting does not visibly move the
 * artwork, and the parts can be merged back losslessly.
 *
 * The caller owns the returned objects; the temporary paragraphs are disposed
 * here.
 */
export function splitTextObject(
  source: CalligraphyTextObject,
  fonts: SkTypefaceFontProvider,
  canvasWidth: number,
): SplitOutcome {
  if (source.part) {
    return { ok: false, reason: 'already-a-part' };
  }

  const clusters = segmentClusters(source.text);
  if (clusters.length < 2) {
    return { ok: false, reason: 'too-few-clusters' };
  }

  const sourceLayout = layoutArabicText(
    specFor(source, source.text, source.wrapWidth, canvasWidth),
    fonts,
  );
  if (!sourceLayout) {
    return { ok: false, reason: 'layout-failed' };
  }

  const {
    paragraph: sourceParagraph,
    width: sourceW,
    height: sourceH,
  } = sourceLayout;
  const t = source.transform;
  const rad = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const scaleX = t.flipH ? -t.scale : t.scale;
  const scaleY = t.flipV ? -t.scale : t.scale;

  const parts: CalligraphyTextObject[] = [];

  try {
    for (let index = 0; index < clusters.length; index += 1) {
      const cluster = clusters[index];

      const sourceRects = sourceParagraph.getRectsForRange(
        cluster.start,
        cluster.end,
      );
      if (sourceRects.length !== 1) {
        // The cluster straddles a soft wrap; it has no single position to move
        // to, so refuse rather than produce a misplaced part.
        return { ok: false, reason: 'cluster-wrapped' };
      }

      const partLayout = layoutArabicText(
        // `wrapWidth: null` makes the part hug its own glyphs.
        specFor(source, cluster.text, null, canvasWidth),
        fonts,
      );
      if (!partLayout) {
        return { ok: false, reason: 'layout-failed' };
      }

      let offsetX: number;
      let offsetY: number;
      try {
        const partRects = partLayout.paragraph.getRectsForRange(
          0,
          cluster.text.length,
        );
        if (partRects.length !== 1) {
          return { ok: false, reason: 'cluster-wrapped' };
        }

        const sourceRect = sourceRects[0];
        const partRect = partRects[0];

        // Ink centre in the source object's local frame (content is authored
        // centred on the origin, hence the half-box subtraction).
        const inkX = sourceRect.x + sourceRect.width / 2 - sourceW / 2;
        const inkY = sourceRect.y + sourceRect.height / 2 - sourceH / 2;
        // Where the part's own ink sits inside the part's local frame.
        const selfX = partRect.x + partRect.width / 2 - partLayout.width / 2;
        const selfY = partRect.y + partRect.height / 2 - partLayout.height / 2;

        const localX = inkX - selfX;
        const localY = inkY - selfY;

        // Map the local offset into design space through the source transform,
        // which the canvas applies as translate → rotate → scale.
        const sx = localX * scaleX;
        const sy = localY * scaleY;
        offsetX = t.x + sx * cos - sy * sin;
        offsetY = t.y + sx * sin + sy * cos;
      } finally {
        partLayout.paragraph.dispose();
      }

      parts.push({
        id: makePartId(),
        type: 'text',
        text: cluster.text,
        fontKey: source.fontKey,
        fontSize: source.fontSize,
        lineHeight: source.lineHeight,
        // Parts always hug their glyphs; an inherited wrap width would re-flow
        // them and break the alignment computed above.
        wrapWidth: null,
        align: source.align,
        color: source.color,
        opacity: source.opacity,
        outline: source.outline,
        shadows: source.shadows,
        presentation: source.presentation,
        part: {
          rootId: source.id,
          index,
          count: clusters.length,
          ...(cluster.gapBefore ? { gapBefore: cluster.gapBefore } : {}),
        },
        transform: {
          ...t,
          x: offsetX,
          y: offsetY,
        },
        // All parts keep the source's z-index: they occupy the same layer, and
        // a stable sort preserves their reading order.
        zIndex: source.zIndex,
        locked: source.locked,
      });
    }
  } finally {
    sourceParagraph.dispose();
  }

  return { ok: true, parts };
}

/**
 * Rebuild the original string from a complete set of parts, using each part's
 * own (possibly edited) text plus the separators captured at split time.
 * Returns null when the group is incomplete, so a partial selection is never
 * silently merged.
 */
export function mergePartTexts(parts: CalligraphyTextObject[]): string | null {
  if (parts.length === 0) {
    return null;
  }
  const count = parts[0].part?.count;
  if (count === undefined || parts.length !== count) {
    return null;
  }
  return parts
    .slice()
    .sort((a, b) => (a.part?.index ?? 0) - (b.part?.index ?? 0))
    .map((p) => (p.part?.gapBefore ?? '') + p.text)
    .join('');
}
