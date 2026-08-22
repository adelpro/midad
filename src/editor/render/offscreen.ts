import { PaintStyle, Skia } from '@shopify/react-native-skia';
import type { SkPaint, SkTypefaceFontProvider } from '@shopify/react-native-skia';

import { SHAPE_BASE_SIZE, drawShapeOnCanvas } from '@/editor/skia/shape-geometry';
import { layoutArabicText } from '@/editor/skia/text';
import type { MidadProject } from '@/storage/project-schema';

export interface RenderedPngResult {
  base64DataUri: string;
  widthPx: number;
  heightPx: number;
}

export interface OffscreenRenderOptions {
  /** Target size of the longest canvas side in pixels. Default 2048. */
  maxWidthPx?: number;
}

function solidPaint(color: string): SkPaint {
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(color));
  paint.setStyle(PaintStyle.Fill);
  return paint;
}

/**
 * Rasterize the project offscreen, mirroring EditorCanvas's conventions:
 * zIndex-ascending draw order, per-object translate/rotate/scale+flip around
 * the object center, paragraphs centered via layout metrics.
 */
export function renderProjectToPng(
  project: MidadProject,
  fonts: SkTypefaceFontProvider | null,
  options?: OffscreenRenderOptions,
): RenderedPngResult {
  const { width: W, height: H } = project.canvas;
  const longest = Math.max(W, H, 1);
  const s = (options?.maxWidthPx ?? 2048) / longest;
  const w = Math.max(1, Math.round(W * s));
  const h = Math.max(1, Math.round(H * s));

  const hasText = project.objects.some((o) => o.type === 'text');
  if (hasText && !fonts) {
    throw new Error('fonts-not-loaded');
  }

  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) {
    throw new Error('offscreen-surface-unavailable');
  }

  const c = surface.getCanvas();
  c.clear(Skia.Color('transparent'));

  const bg = project.canvas.background;
  if (bg.type !== 'transparent') {
    const color = bg.type === 'paper' ? bg.color ?? '#F7F6F3' : '#FFFFFF';
    c.save();
    c.scale(s, s);
    c.drawRect(Skia.XYWHRect(0, 0, W, H), solidPaint(color));
    c.restore();
  }

  c.save();
  c.scale(s, s);

  const sorted = [...project.objects].sort((a, b) => a.zIndex - b.zIndex);
  for (const obj of sorted) {
    if (obj.type === 'glyph') continue; // parity with EditorCanvas: glyphs not rendered yet
    const t = obj.transform;
    c.save();
    c.translate(t.x, t.y);
    c.rotate(t.rotation, 0, 0);
    c.scale(t.flipH ? -t.scale : t.scale, t.flipV ? -t.scale : t.scale);

    if (obj.type === 'text') {
      const rendered = layoutArabicText(
        {
          text: obj.text,
          fontKey: obj.fontKey,
          fontSize: obj.fontSize,
          lineHeight: obj.lineHeight,
          align: obj.align,
          color: obj.color,
          opacity: obj.opacity,
          maxWidth: W,
          outline: obj.outline,
        },
        fonts as NonNullable<SkTypefaceFontProvider>,
      );
      if (rendered) {
        rendered.paragraph.paint(c, -rendered.width / 2, -rendered.height / 2);
        rendered.paragraph.dispose();
      }
    } else {
      const box = SHAPE_BASE_SIZE * (t.scale || 1);
      c.translate(-box / 2, -box / 2);
      drawShapeOnCanvas(c, obj, box);
    }
    c.restore();
  }
  c.restore();

  surface.flush();
  const image = surface.makeImageSnapshot();
  const b64 = image.encodeToBase64();
  if (!b64) {
    throw new Error('png-encode-failed');
  }
  return { base64DataUri: `data:image/png;base64,${b64}`, widthPx: w, heightPx: h };
}
