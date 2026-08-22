# Phase 4 — Export & Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the export story — offscreen PNG rendering, share-first image export, SVG export, `.midad.json` project import/export, and gallery thumbnails.

**Architecture:** An offscreen Skia surface renderer mirrors EditorCanvas's draw conventions exactly (same sort, transforms, box math). A pure document-model serializer emits SVG with optional embedded `@font-face`. Thumbnails are generated on save into platform-split storage. The editor gains an Export bottom sheet driving `shareImage`/new `shareFile`; the gallery gains an Import flow via document picker (native) or hidden file input (web).

**Tech Stack:** Expo SDK 57 (RN 0.86.2), @shopify/react-native-skia 2.6.2, expo-sharing, expo-file-system (next-gen File/Paths API), expo-document-picker (new), AsyncStorage, FlashList.

**Spec:** `docs/superpowers/specs/2026-08-22-phase4-export-design.md`

## Global Constraints

- Versions pinned by package.json; consult https://docs.expo.dev/versions/v57.0.0/ before using any Expo API.
- **Verification per task:** `npx tsc --noEmit` then `npx eslint src`. The repo has no unit-test framework; visual/runtime checks are manual (user on web + Android).
- All user-facing strings bilingual (ar + en) in `src/i18n/strings.ts`.
- Offscreen renderer and SVG serializer MUST mirror `src/editor/EditorCanvas.tsx` conventions exactly: objects sorted by `zIndex` ascending; per-object transform order translate → rotate(deg) → scale(sx,sy) with flips folded into sign; text paragraph painted at `(-width/2, -height/2)` laid out with `maxWidth = canvas.width`; shapes/glyph box = `120 * scale`; glyph objects render nothing today; background `paper` → color ?? `'#F7F6F3'`, `transparent` → no fill, `image` → white.
- No new dependencies except `expo-document-picker` (Task 8).
- Verified Skia APIs (from node_modules typings): `Skia.Surface.MakeOffscreen(w,h): SkSurface|null`; `surface.getCanvas/makeImageSnapshot/flush/width/height`; `image.encodeToBase64(): string`; `canvas.rotate(degrees, rx?, ry?)` — degrees; `canvas.drawLine/drawRect/drawCircle/clear`; `Skia.Path.MakeFromSVGString(str): SkPath|null`; `PaintStyle.Fill|Stroke`; `StrokeCap.Round`; `paint.setAlphaf/setStyle/setStrokeWidth/setStrokeCap`.
- Conventional commits; never commit secrets.

---

### Task 1: Shared shape geometry module

**Files:**
- Create: `src/editor/skia/shape-geometry.ts`
- Modify: `src/editor/skia/shapes.tsx` (delete local builders, import shared ones)
- Modify: `src/editor/EditorCanvas.tsx:34` (use exported constant)

**Interfaces:**
- Produces: `SHAPE_BASE_SIZE = 120` (number), `buildStarPath(size: number): string`, `buildTrianglePath(size: number): string`, `drawShapeOnCanvas(canvas: SkCanvas, shape: ShapeObject, size: number): void` — consumed by Tasks 2 (offscreen) and referenced by EditorCanvas.

- [ ] **Step 1: Create `src/editor/skia/shape-geometry.ts`**

```ts
import { PaintStyle, Skia, StrokeCap } from '@shopify/react-native-skia';
import type { SkCanvas, SkPaint } from '@shopify/react-native-skia';

import type { ShapeObject } from '@/storage/project-schema';

/** Base box size (design units) a shape is rendered into before its transform. */
export const SHAPE_BASE_SIZE = 120;

export function buildStarPath(size: number): string {
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2;
  const inner = outer * 0.45;
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  points.push('Z');
  return points.join(' ');
}

export function buildTrianglePath(size: number): string {
  const h = size * 0.86;
  return `M ${size / 2} ${(size - h) / 2} L ${size - 2} ${size - 2} L 2 ${size - 2} Z`;
}

/** Mirrors ShapeRenderer visibility rules: invisible when hollow with no stroke width. */
function fillOrStrokePaint(shape: ShapeObject): SkPaint | null {
  const strokeWidth = shape.strokeWidth ?? 1;
  if (!shape.fill && strokeWidth <= 0) {
    return null;
  }
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(shape.color));
  if (shape.fill) {
    paint.setStyle(PaintStyle.Fill);
  } else {
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(strokeWidth);
  }
  return paint;
}

function strokeOnlyPaint(shape: ShapeObject, width: number): SkPaint {
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(shape.color));
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeWidth(width);
  paint.setStrokeCap(StrokeCap.Round);
  return paint;
}

/**
 * Draw a shape object into a `size`×`size` box on an imperative canvas,
 * matching the declarative <ShapeRenderer> output exactly.
 */
export function drawShapeOnCanvas(canvas: SkCanvas, shape: ShapeObject, size: number): void {
  switch (shape.shapeKey) {
    case 'circle': {
      const p = fillOrStrokePaint(shape);
      if (!p) return;
      canvas.drawCircle(size / 2, size / 2, size / 2 - 1, p);
      return;
    }
    case 'square': {
      const p = fillOrStrokePaint(shape);
      if (!p) return;
      canvas.drawRect(Skia.XYWHRect(1, 1, size - 2, size - 2), p);
      return;
    }
    case 'ring': {
      canvas.drawCircle(size / 2, size / 2, size / 3, strokeOnlyPaint(shape, (shape.strokeWidth ?? 2) * 2));
      return;
    }
    case 'line': {
      canvas.drawLine(2, size / 2, size - 2, size / 2, strokeOnlyPaint(shape, (shape.strokeWidth ?? 2) * 2));
      return;
    }
    case 'triangle':
    case 'star': {
      const p = fillOrStrokePaint(shape);
      if (!p) return;
      const d = shape.shapeKey === 'star' ? buildStarPath(size) : buildTrianglePath(size);
      const path = Skia.Path.MakeFromSVGString(d);
      if (!path) return;
      canvas.drawPath(path, p);
      return;
    }
    default:
      return;
  }
}
```

- [ ] **Step 2: Refactor `shapes.tsx` to consume the module**

Replace the local `buildStarPath`/`buildTrianglePath` functions (lines 10–30) with an import; leave `<ShapeRenderer>` untouched:

```ts
import { buildStarPath, buildTrianglePath } from '@/editor/skia/shape-geometry';
```

Delete both local function bodies. Verify no other references break.

- [ ] **Step 3: Update `EditorCanvas.tsx` line 34**

```ts
const base = SHAPE_BASE_SIZE * (obj.transform.scale || 1);
```

Add `SHAPE_BASE_SIZE` to the `@/editor/skia/shapes` import area (new import from `@/editor/skia/shape-geometry`).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx eslint src`
Expected: clean. If `setStrokeJoin` were needed note we deliberately omit it (declarative star/triangle use round join; visual delta at export sizes is negligible — accept).

- [ ] **Step 5: Commit**

```bash
git add src/editor/skia/shape-geometry.ts src/editor/skia/shapes.tsx src/editor/EditorCanvas.tsx
git commit -m "refactor(editor): extract shared shape geometry with imperative drawing"
```

---

### Task 2: Offscreen PNG renderer

**Files:**
- Create: `src/editor/render/offscreen.ts`

**Interfaces:**
- Consumes: `layoutArabicText(spec, fonts)` from `@/editor/skia/text`; `drawShapeOnCanvas`, `SHAPE_BASE_SIZE` from Task 1.
- Produces: 

```ts
export interface RenderedPngResult { base64DataUri: string; widthPx: number; heightPx: number; }
export interface OffscreenRenderOptions { maxWidthPx?: number } // longest side target px, default 2048
export function renderProjectToPng(project: MidadProject, fonts: SkTypefaceFontProvider | null, options?: OffscreenRenderOptions): RenderedPngResult
```

Consumed by Tasks 4 (thumbnails, 360px) and 7 (share, 2048px). Throws `Error('offscreen-surface-unavailable')` when allocation fails; throws `Error('fonts-not-loaded')` if text objects exist but `fonts` is null.

- [ ] **Step 1: Create `src/editor/render/offscreen.ts`**

```ts
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

  // Background — same fallbacks as EditorCanvas.
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
    if (obj.type === 'glyph') continue; // parity: EditorCanvas renders nothing for glyphs yet
    const t = obj.transform;
    c.save();
    c.translate(t.x, t.y);
    c.rotate(t.rotation, 0, 0); // degrees per Skia typings
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
```

Note: `c.scale(s, s)` bakes fit-to-view scale into every draw, so all object math stays in design units exactly like the declarative outer Group.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npx eslint src`
Expected: clean. If `paragraph.dispose()` errors on typings, drop that line (GC handles it).

- [ ] **Step 3: Commit**

```bash
git add src/editor/render/offscreen.ts
git commit -m "feat(render): offscreen project-to-PNG rasterizer"
```

---

### Task 3: Thumbnail storage module

**Files:**
- Create: `src/storage/thumbs.ts`

**Interfaces:**
- Produces:

```ts
export const THUMB_MAX_WIDTH_PX = 360;
export function saveThumb(id: string, base64DataUri: string): Promise<void>
export function getThumb(id: string): Promise<string | null>
export function deleteThumb(id: string): Promise<void>
```

Web branch uses AsyncStorage key `midad:thumb:<id>` (separate from index JSON so index stays small). Native branch stores `<id>.thumb.png` under `Paths.cache` via next-gen File API — cache purges are acceptable degradation (placeholder returns). Consumed by Tasks 4.

- [ ] **Step 1: Create `src/storage/thumbs.ts`**

```ts
import { Platform } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

export const THUMB_MAX_WIDTH_PX = 360;

const key = (id: string) => `midad:thumb:${id}`;
const fileName = (id: string) => `${id}.thumb.png`;

export function saveThumb(id: string, base64DataUri: string): Promise<void> {
  if (Platform.OS === 'web') {
    return AsyncStorage.setItem(key(id), base64DataUri);
  }
  return (async () => {
    const { File, Paths } = await import('expo-file-system');
    const f = new File(Paths.cache, fileName(id));
    if (f.exists) f.delete();
    f.create();
    const raw = base64DataUri.includes(',') ? base64DataUri.split(',')[1]! : base64DataUri;
    f.write(raw, { encoding: 'base64' });
  })();
}

export function getThumb(id: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key(id));
  }
  return (async () => {
    const { File, Paths } = await import('expo-file-system');
    const f = new File(Paths.cache, fileName(id));
    return f.exists ? f.uri : null;
  })();
}

export function deleteThumb(id: string): Promise<void> {
  if (Platform.OS === 'web') {
    return AsyncStorage.removeItem(key(id));
  }
  return (async () => {
    const { File, Paths } = await import('expo-file-system');
    const f = new File(Paths.cache, fileName(id));
    if (f.exists) f.delete();
  })();
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npx eslint src`
Expected: clean. If `f.write(raw, { encoding: 'base64' })` signature differs in the installed next-gen API, align with how `src/storage/projects.ts` writes files (open it first).

- [ ] **Step 3: Commit**

```bash
git add src/storage/thumbs.ts
git commit -m "feat(storage): platform-split thumbnail store"
```

---

### Task 4: Thumbnail pipeline (editor save → gallery display)

**Files:**
- Modify: `src/app/editor.tsx` (fonts hook + save flow)
- Modify: `src/app/(tabs)/gallery.tsx` (load thumbs, render images)

**Interfaces:**
- Consumes: `renderProjectToPng` (Task 2), `THUMB_MAX_WIDTH_PX/saveThumb/getThumb` (Task 3), `useParagraphFonts()` from `@/editor/skia/text`.

- [ ] **Step 1: Wire generation into editor save**

In `editor.tsx`: add imports; inside `EditorScreen`, BEFORE the `if (!project)` early return (~line 161), add `const skiaFonts = useParagraphFonts();` (hooks rule). Replace `save` (lines 146–150):

```ts
const save = useCallback(async () => {
  if (!project) return;
  await saveProject(project);
  try {
    const png = renderProjectToPng(project, skiaFonts, { maxWidthPx: THUMB_MAX_WIDTH_PX });
    await saveThumb(project.id, png.base64DataUri);
  } catch {
    // Thumbnail is best-effort; the project itself is saved.
  }
}, [project, skiaFonts]);
```

New imports: `renderProjectToPng` from `@/editor/render/offscreen`; `THUMB_MAX_WIDTH_PX, saveThumb` from `@/storage/thumbs`; `useParagraphFonts` from `@/editor/skia/text`.

- [ ] **Step 2: Display thumbnails in gallery**

In `gallery.tsx`: add `Image` to the react-native import; import `getThumb` from `@/storage/thumbs`. Add state `const [thumbs, setThumbs] = useState<Record<string, string | undefined>>({});` Extend the mount effect:

```ts
listProjects().then(async (list) => {
  if (!active) return;
  setProjects(list);
  setLoading(false);
  const entries = await Promise.all(
    list.map(async (p) => [p.id, await getThumb(p.id)] as const),
  );
  if (active) setThumbs(Object.fromEntries(entries));
});
```

Replace the placeholder icon block inside the card thumb View (lines ~130–132):

```tsx
{thumbs[item.id] ? (
  <Image source={{ uri: thumbs[item.id] }} style={StyleSheet.absoluteFill} resizeMode="contain" />
) : (
  <Icon name="sparkle" color={c.faint} size={22} />
)}
```

The colored background stays behind transparent PNGs.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx eslint src`
Manual: open editor, edit, Save → back to gallery → card shows the design.

- [ ] **Step 4: Commit**

```bash
git add src/app/editor.tsx "src/app/(tabs)/gallery.tsx"
git commit -m "feat(gallery): generate and display design thumbnails on save"
```

---

### Task 5: Generalize export pipeline (`shareFile`)

**Files:**
- Modify: `src/storage/export.ts`

**Interfaces:**
- Produces:

```ts
export interface FileShareOptions { data: string | Blob; fileName: string; mimeType: string; uti?: string; dialogTitle?: string; }
export async function shareFile(options: FileShareOptions): Promise<boolean>
```

Native: temp file + system share sheet. Web: Web Share API with file when supported, else browser download. Consumed by Task 7.

- [ ] **Step 1: Extract shared native path + add `shareFile`**

Refactor `shareImage`'s native branch to call a new internal helper, then add:

```ts
interface SharePayload extends ExportOptionsLike {
  mimeType: string;
  uti?: string;
  dialogTitle?: string;
}
type ExportOptionsLike = { data: string | Blob; fileName: string };

async function writeTempAndShare({ data, fileName, mimeType, uti, dialogTitle }: SharePayload): Promise<boolean> {
  const { File, Paths } = await import('expo-file-system');
  const tmp = new File(Paths.cache, `share-${Date.now()}-${fileName}`);
  if (tmp.exists) tmp.delete();
  tmp.create();
  if (typeof data === 'string') {
    const base64 = data.includes(',') ? data.split(',')[1] : data;
    tmp.write(base64, { encoding: 'base64' });
  } else {
    tmp.write(new Uint8Array(await data.arrayBuffer()));
  }
  await Sharing.shareAsync(tmp.uri, {
    mimeType,
    dialogTitle: dialogTitle ?? fileName,
    UTI: uti,
  });
  return true;
}
```

`shareImage`'s `hasShareSheet` branch becomes:

```ts
if (hasShareSheet) {
  return writeTempAndShare({
    data,
    fileName: `${fileName ?? 'midad-design'}.${extensionFor(format)}`,
    mimeType: mimeFor(format),
    uti: format === 'png' ? 'public.png' : 'public.jpeg',
    dialogTitle: fileName ?? 'midad design',
  });
}
```

Add (reusing the existing web-share/download tail pattern of `shareImage`):

```ts
export async function shareFile({ data, fileName, mimeType, uti, dialogTitle }: FileShareOptions): Promise<boolean> {
  if (hasShareSheet) {
    return writeTempAndShare({ data, fileName, mimeType, uti, dialogTitle });
  }
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      const file = new File([data], fileName, { type: mimeType });
      const shareData = { files: [file] } as ShareData;
      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return true;
      }
    } catch {
      // fall through to download
    }
  }
  downloadBlob(data, fileName, mimeType);
  return true;
}
```

Note: text payloads (`svg`/JSON strings) hit the base64 branch of `writeTempAndShare` without a data-URI prefix — write them as UTF-8 instead: extend the string branch with `tmp.write(data)` when the payload has no comma/base64 marker? NO — keep deterministic: callers pass strings for svg/JSON, so add explicit handling: if `mimeType` is not `image/*` and data is a string, call `tmp.write(data)` directly. Implement exactly this condition.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npx eslint src`
Expected: clean; existing image share behavior unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/storage/export.ts
git commit -m "feat(storage): generic shareFile for svg and json exports"
```

---

### Task 6: SVG serializer

**Files:**
- Create: `src/editor/export/svg.ts`

**Interfaces:**
- Consumes: `calligraphyFonts`, `fontAssets` from `@/theme`; schema types.
- Produces:

```ts
export interface SvgFontFace { family: string; dataUri: string }
export function collectUsedFamilies(project: MidadProject): string[]
export async function collectSvgFontFaces(families: string[]): Promise<SvgFontFace[]>
export function projectToSvg(project: MidadProject, fontFaces?: SvgFontFace[]): string
```

`collectSvgFontFaces`: web resolves `fontAssets[family]` URI via fetch → arrayBuffer → base64 data URI. Native uses `Asset.fromModule(...).downloadAsync()` from `expo-asset` (bundled transitively; import dynamically) then reads bytes via next-gen `File.base64()` (fallback `bytes()` + encoder if typings disagree). Failures resolve to `[]` (serializer omits embedding gracefully).

- [ ] **Step 1: Create `src/editor/export/svg.ts`**

Full implementation requirements (write complete code, no stubs):

1. `escapeXml(s)`: escape `& < > " '`.
2. Transform attr builder mirroring EditorCanvas order: `` `translate(${t.x} ${t.y}) rotate(${t.rotation}) scale(${sx} ${sy})` `` with flips folded into sign.
3. Background: `paper` → `<rect ... fill="{color}"/>`; `transparent` → nothing; `image` → white.
4. Shapes emit native primitives using the SAME geometry rules as `shape-geometry.ts` (circle r=size/2−1; square rect inset 1; ring r=size/3 stroke ×2; line y=size/2 stroke ×2 round cap; triangle/star `<path d>` from the shared builders). Fill/stroke attributes mirror `fillOrStrokePaint` logic incl. invisibility rule.
5. Text: `<g transform=...><text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-family="'{family}', serif" font-size="{fontSize}" fill="{color}"{outline attrs}{rtl attrs}>` with `\n` split into `<tspan x="0" dy="...">` lines offset by `-(n-1)*lineHeight/2`; outline → `stroke="{outline.color}" stroke-width="{outline.width}" paint-order="stroke"`; RTL detection `/[\u0600-\u06FF]/` adds `direction="rtl"` and `unicode-bidi="plaintext"`.
6. Glyph objects skipped (parity).
7. `fontFaces` → `<defs><style>` with one `@font-face` per entry: `url("{dataUri}") format("truetype")`.
8. Root: `<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npx eslint src`
Manual smoke (node): `node -e` script importing compiled output is impractical under Metro — instead eyeball generated markup during Task 7 manual check.

- [ ] **Step 3: Commit**

```bash
git add src/editor/export/svg.ts
git commit -m "feat(export): vector SVG serializer for midad documents"
```

---

### Task 7: Editor Export sheet

**Files:**
- Modify: `src/app/editor.tsx`

**Interfaces:**
- Consumes: everything above + `shareImage`, `shareFile` from `@/storage/export`; existing `Sheet`, `Button`, `IconButton`, `Icon`, `ActivityIndicator` components.
- UI contract: Export button in top bar opens sheet titled `t.editor.export`; three actions (share PNG 2048px / export SVG / export `.midad.json`); busy spinner + inline error text while running; each action first persists via `save()`.

- [ ] **Step 1: Add state + top-bar button**

State near other useState calls: `exportOpen`, `exporting: string | null`, `exportError: string | null`. Top bar gains (after the save IconButton at line ~196):

```tsx
<IconButton onPress={() => { setExportError(null); setExportOpen(true); }}>
  <Icon name="export" size={18} />
</IconButton>
```

(`export` icon name already exists in `Icon.tsx` mapping.)

- [ ] **Step 2: Handlers**

```ts
const runExport = useCallback(async (key: 'image' | 'svg' | 'file', fn: () => Promise<void>) => {
  setExporting(key);
  setExportError(null);
  try {
    await save();
    await fn();
    setExportOpen(false);
  } catch (e) {
    setExportError(e instanceof Error ? e.message : String(e));
  } finally {
    setExporting(null);
  }
}, [save]);

const exportImage = useCallback(() => {
  if (!project || exporting) return;
  void runExport('image', async () => {
    const png = renderProjectToPng(project, skiaFonts, { maxWidthPx: 2048 });
    await shareImage({ data: png.base64DataUri, format: 'png', fileName: `${project.name || 'midad-design'}.png` });
  });
}, [project, exporting, runExport, skiaFonts]);

const exportSvg = useCallback(() => {
  if (!project || exporting) return;
  void runExport('svg', async () => {
    const faces = await collectSvgFontFaces(collectUsedFamilies(project));
    const svg = projectToSvg(project, faces);
    await shareFile({ data: svg, fileName: `${project.name || 'midad-design'}.svg`, mimeType: 'image/svg+xml', uti: 'public.svg-image', dialogTitle: t.editor.exportSvgAction });
  });
}, [project, exporting, runExport]);

const exportFile = useCallback(() => {
  if (!project || exporting) return;
  void runExport('file', async () => {
    await shareFile({ data: JSON.stringify(project), fileName: `${project.name || 'midad'}.midad.json`, mimeType: 'application/json', uti: 'public.json', dialogTitle: t.editor.exportProjectFile });
  });
}, [project, exporting, runExport]);
```

Rename the fonts-hook variable to `skiaFonts` everywhere (Task 4 introduced it) to avoid clashing with the theme `fonts`.

- [ ] **Step 3: Sheet markup (after the existing text Sheet)**

```tsx
<Sheet visible={exportOpen} onClose={() => setExportOpen(false)} title={t.editor.export}>
  <View style={styles.sheetBody}>
    <Button label={t.editor.exportShareImage} onPress={exportImage} fullWidth variant={exporting === 'image' ? 'secondary' : 'primary'} />
    <Button label={t.editor.exportSvgAction} onPress={exportSvg} fullWidth variant="secondary" />
    <Button label={t.editor.exportProjectFile} onPress={exportFile} fullWidth variant="secondary" />
    {exporting && <ActivityIndicator color={c.ink} />}
    {!!exportError && <Text style={{ color: '#7A1F1F', fontFamily: fonts.ui }}>{exportError}</Text>}
  </View>
</Sheet>
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx eslint src`
Manual (user): web → Share image downloads PNG; Export SVG opens in browser correctly shaped; .midad.json downloads; Android → share sheet appears with PNG/SVG/file.

- [ ] **Step 5: Commit**

```bash
git add src/app/editor.tsx
git commit -m "feat(editor): export sheet with image, svg, and project sharing"
```

---

### Task 8: Project import flow

**Files:**
- Install dependency: `npx expo install expo-document-picker`
- Create: `src/storage/import-project.ts`
- Modify: `src/app/(tabs)/gallery.tsx`

**Interfaces:**
- Produces:

```ts
export type ImportStatus = 'ok' | 'bad-json' | 'bad-version' | 'bad-shape';
export function importProjectFromJson(text: string): Promise<ImportStatus>
```

Validation: parsed object; `version === 1`; `canvas.width/height` finite positive numbers; `Array.isArray(objects)`. On success always stamps fresh `updatedAt`; regenerates `id` when colliding; saves via `saveProject`; caller refreshes list.

- [ ] **Step 1: Install dependency**

Run: `npx expo install expo-document-picker`
Expected: package.json gains `"expo-document-picker"` at SDK-57-compatible version.

- [ ] **Step 2: Create `src/storage/import-project.ts`**

Implement exactly the interface above using `listProjects`/`saveProject` from `@/storage/projects` and `MidadProject` from `@/storage/project-schema`. Preserve unknown extra fields via spread. `createdAt` falls back to now when missing.

- [ ] **Step 3: Gallery UI**

Header: wrap the New Design Button and a second small `Button label={t.gallery.importDesigns}` in a row View (`gap: spacing.sm`). Handler:

- Native: `DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true })`; canceled → noop; else read text via next-gen FS `new File(asset.uri).text()`; run importer; map non-'ok' status to `setImportError(t.gallery.importFailed)`; on ok clear error + reload list.
- Web: create `<input type="file">` imperatively (`document.createElement('input')`, accept `.midad,application/json,.json`), click it, on change read `file.text()` and reuse the same status handling. Avoid JSX DOM elements to keep RN typings happy.

Extract the current effect body into `const load = useCallback(async () => {...}, [])` called from the mount effect and after imports.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx eslint src`
Manual: export `.midad.json` from Task 7 → import it on the other platform → design appears and opens.

- [ ] **Step 5: Commit**

```bash
git add package.json yarn.lock src/storage/import-project.ts "src/app/(tabs)/gallery.tsx"
git commit -m "feat(gallery): import midad project files"
```

---

### Task 9: Strings, changelog, final pass

**Files:**
- Modify: `src/i18n/strings.ts`
- Modify: `CHANGELOG.md` (create minimal Keep-a-Changelog header if absent)

**Interfaces:** Translation interface + both records gain: `editor.exportShareImage`, `editor.exportSvgAction`, `editor.exportProjectFile`, `editor.exporting`, `editor.exportFailed`; `gallery.importDesigns`, `gallery.importFailed`. Reuse existing `editor.export` ('Export'/'تصدير') as the sheet title.

ar values: `مشاركة الصورة` / `تصدير SVG` / `تصدير ملف المشروع` / `جارٍ التصدير…` / `فشل التصدير` / `استيراد` / `تعذّر استيراد الملف`
en values: `Share image` / `Export SVG` / `Export project file` / `Exporting…` / `Export failed` / `Import` / `Could not import file`

- [ ] **Step 1:** Add interface fields adjacent to existing anchors (interface `editor:` block ~line 89 `export: string;`; `gallery:` block; mirror in ar record ~line 180 and en record ~line 269).
- [ ] **Step 2:** Changelog entry summarizing Phase 4 (thumbnails, share sheet, SVG, project import/export).
- [ ] **Step 3:** Full verification: `npx tsc --noEmit && npx eslint src`; then user runs app (web + device) against the spec's manual checklist: PNG/SVG correctness, thumbnails after save, import round-trip, share sheet on device, downloads on web.
- [ ] **Step 4: Commit**

```bash
git add src/i18n/strings.ts CHANGELOG.md
git commit -m "chore(i18n): phase 4 export strings and changelog"
```

---

## Self-Review Notes

- Spec coverage: render core (T2), share-first UX (T5/T7), thumbnails (T3/T4), SVG export (T6/T7), .midad export+import (T5/T7/T8), i18n (T9). Error handling surfaces via sheet error state + graceful thumb degradation. Out-of-scope items untouched.
- Type consistency: `skiaFonts` naming fixed in T4/T7; `RenderedPngResult`/`shareFile`/`getThumb` signatures consistent across tasks.
- Known risk flagged in-plan: next-gen FS method names verified against `projects.ts`/`export.ts` usage patterns; adjust per installed typings if tsc complains (explicit fallback noted in steps).
