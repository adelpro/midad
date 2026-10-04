import type {
  SkCanvas,
  SkPaint,
  SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import { PaintStyle, Skia } from '@shopify/react-native-skia';

import { drawGlyphOnCanvas } from '@/editor/skia/glyph-shape';
import { IMAGE_BASE_SIZE } from '@/editor/skia/image-shape';
import {
  SHAPE_BASE_SIZE,
  drawShapeOnCanvas,
} from '@/editor/skia/shape-geometry';
import { layoutArabicText } from '@/editor/skia/text';
import { dataUriToBase64 } from '@/storage/background-image';
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
 * Draw a placed image into the `0..w, 0..h` box the caller has already
 * translated to. Mirrors `EditorCanvas`'s `PlacedImage` and the SVG path's
 * `<image>`: contain-fit, and nothing at all when the bytes cannot be decoded.
 *
 * A failed decode is not an error here — the storage contract lets a design open
 * with an asset entry missing, and the object then simply draws nothing.
 */
function drawPlacedImageOnCanvas(
  c: SkCanvas,
  obj: { imageUri?: string },
  w: number,
  h: number,
): void {
  if (!obj.imageUri) {
    return;
  }
  const data = Skia.Data.fromBase64(dataUriToBase64(obj.imageUri));
  const img = Skia.Image.MakeImageFromEncoded(data);
  if (!img) {
    return;
  }
  const iw = img.width();
  const ih = img.height();
  // Contain: scale by the smaller ratio so the whole picture fits the box.
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  c.drawImageRect(
    img,
    Skia.XYWHRect(0, 0, iw, ih),
    Skia.XYWHRect((w - dw) / 2, (h - dh) / 2, dw, dh),
    Skia.Paint(),
  );
}

/**
 * Draw a background image over the full canvas with cover fit — scale to fill
 * and center-crop the overflow, matching the live canvas and SVG export. Falls
 * back to white if the image cannot be decoded.
 */
function drawBackgroundImage(
  c: SkCanvas,
  imageUri: string,
  W: number,
  H: number,
): void {
  const data = Skia.Data.fromBase64(dataUriToBase64(imageUri));
  const img = Skia.Image.MakeImageFromEncoded(data);
  if (!img) {
    c.drawRect(Skia.XYWHRect(0, 0, W, H), solidPaint('#FFFFFF'));
    return;
  }
  const iw = img.width();
  const ih = img.height();
  const scale = Math.max(W / iw, H / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (W - dw) / 2;
  const dy = (H - dh) / 2;
  c.drawImageRect(
    img,
    Skia.XYWHRect(0, 0, iw, ih),
    Skia.XYWHRect(dx, dy, dw, dh),
    Skia.Paint(),
  );
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
    c.save();
    c.scale(s, s);
    if (bg.type === 'image' && bg.imageUri) {
      drawBackgroundImage(c, bg.imageUri, W, H);
    } else {
      const color = bg.type === 'paper' ? (bg.color ?? '#F7F6F3') : '#FFFFFF';
      c.drawRect(Skia.XYWHRect(0, 0, W, H), solidPaint(color));
    }
    c.restore();
  }

  c.save();
  c.scale(s, s);

  const sorted = [...project.objects].sort((a, b) => a.zIndex - b.zIndex);
  for (const obj of sorted) {
    const t = obj.transform;
    c.save();
    c.translate(t.x, t.y);
    c.rotate(t.rotation, 0, 0);
    c.scale(t.flipH ? -t.scale : t.scale, t.flipV ? -t.scale : t.scale);

    // Composite the object through an alpha layer rather than baking opacity
    // into its colours, so opacity never has to re-shape a paragraph.
    const opacity = obj.opacity ?? 1;
    const faded = opacity < 1;
    if (faded) {
      const layerPaint = Skia.Paint();
      layerPaint.setAlphaf(opacity);
      c.saveLayer(layerPaint);
    }

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
          wrapWidth: obj.wrapWidth,
          maxWidth: W,
          shadows: obj.shadows,
        },
        fonts as NonNullable<SkTypefaceFontProvider>,
      );
      if (rendered) {
        rendered.paragraph.paint(c, -rendered.width / 2, -rendered.height / 2);
        rendered.paragraph.dispose();
      }
    } else if (obj.type === 'shape') {
      // Local units: the canvas has already been scaled by the object transform.
      c.translate(-SHAPE_BASE_SIZE / 2, -SHAPE_BASE_SIZE / 2);
      drawShapeOnCanvas(c, obj, SHAPE_BASE_SIZE);
    } else if (obj.type === 'image') {
      // The object's own box, not the square base: a placed image is as wide as
      // its aspect says. Same `-box/2` shift the shape and glyph paths use, so
      // the box stays centred on the object origin.
      const w = IMAGE_BASE_SIZE * obj.aspect;
      c.translate(-w / 2, -IMAGE_BASE_SIZE / 2);
      drawPlacedImageOnCanvas(c, obj, w, IMAGE_BASE_SIZE);
    } else {
      c.translate(-SHAPE_BASE_SIZE / 2, -SHAPE_BASE_SIZE / 2);
      drawGlyphOnCanvas(c, obj, SHAPE_BASE_SIZE);
    }
    if (faded) {
      c.restore();
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
  return {
    base64DataUri: `data:image/png;base64,${b64}`,
    widthPx: w,
    heightPx: h,
  };
}
