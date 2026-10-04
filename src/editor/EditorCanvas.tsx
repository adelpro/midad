import {
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Line,
  Paragraph,
  Rect,
  Skia,
  Image as SkiaImage,
  vec,
  type SkImage,
} from '@shopify/react-native-skia';
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { selectionFrame, type CollectionFrame } from '@/editor/groups';
import {
  frameBox,
  hitTest,
  resizeHandles,
  ROTATE_GRIP_RADIUS,
  rotateHandle,
  safeObjectScale,
  selectionPad,
  type SizedObject,
} from '@/editor/hit-test';
import { GlyphRenderer } from '@/editor/skia/glyph-shape';
import { IMAGE_BASE_SIZE } from '@/editor/skia/image-shape';
import { SHAPE_BASE_SIZE } from '@/editor/skia/shape-geometry';
import { ShapeRenderer } from '@/editor/skia/shapes';
import {
  textObjectSize,
  useTextLayouts,
  type TextLayouts,
} from '@/editor/skia/use-text-layouts';
import { useEditorStore } from '@/editor/store';
import { dataUriToBase64 } from '@/storage/background-image';
import type { DesignObject, MidadProject } from '@/storage/project-schema';

export interface EditorCanvasProps {
  project: MidadProject;
  selectedIds: string[];
  /** Hit-test target point (design units); triggers selection changes. */
  tapPoint?: { x: number; y: number } | null;
  onTapResult?: (id: string | null) => void;
}

function objectBox(
  obj: DesignObject,
  layouts: ReturnType<typeof useTextLayouts>,
): { width: number; height: number } {
  switch (obj.type) {
    case 'text': {
      const layout = layouts[obj.id];
      return textObjectSize(layout, obj.fontSize, obj.wrapWidth);
    }
    case 'image':
      // A placed image's box follows its own aspect, so the frame hugs the
      // picture instead of letterboxing it inside a square.
      return { width: IMAGE_BASE_SIZE * obj.aspect, height: IMAGE_BASE_SIZE };
    case 'shape':
    case 'glyph':
      // Local (unscaled) box. The object's transform group supplies the scale,
      // so including it here would apply it twice.
      return { width: SHAPE_BASE_SIZE, height: SHAPE_BASE_SIZE };
  }
}

/**
 * Decodes the design's background image from its embedded base64 payload.
 *
 * Deliberately not `useImage`: that hook loads by URI, and Skia's native
 * `Data.fromURI` cannot read a `data:` URI — the Android loader hands it to
 * `java.net.URL`, which has no `data:` handler — so the promise never resolves
 * and the canvas keeps the white fallback forever. Decoding through
 * `Skia.Data.fromBase64` is the same path the PNG export already takes, so the
 * live canvas and the export agree on what the image is.
 */
function useBackgroundImage(uri: string): SkImage | null {
  return useMemo(() => {
    try {
      const data = Skia.Data.fromBase64(dataUriToBase64(uri));
      return Skia.Image.MakeImageFromEncoded(data);
    } catch {
      return null;
    }
  }, [uri]);
}

/**
 * The design's background image, drawn behind every object.
 *
 * `fit="cover"` scales the image to fill the canvas and crops the overflow —
 * the same mapping the PNG and SVG export paths use.
 */
function BackgroundImage({
  uri,
  width,
  height,
}: {
  uri: string;
  width: number;
  height: number;
}) {
  const image = useBackgroundImage(uri);
  if (!image) {
    return <Rect x={0} y={0} width={width} height={height} color="#FFFFFF" />;
  }
  return (
    <SkiaImage
      image={image}
      x={0}
      y={0}
      width={width}
      height={height}
      fit="cover"
    />
  );
}

/**
 * A placed image, drawn into its own box.
 *
 * `fit="contain"` against a box that already carries the image's aspect ratio is
 * a no-op mapping — it is there so a decoded image whose real dimensions disagree
 * with the persisted `aspect` (a hand-edited file, a future crop) is letterboxed
 * inside the frame rather than silently stretched.
 *
 * A missing or undecodable URI draws nothing. That is the storage contract's
 * graceful degradation: an exported design whose asset entry was dropped still
 * opens, with the object present and empty, instead of throwing.
 */
function PlacedImage({
  uri,
  width,
  height,
}: {
  uri?: string;
  width: number;
  height: number;
}) {
  const image = useBackgroundImage(uri ?? '');
  if (!image) {
    return null;
  }
  return (
    <SkiaImage
      image={image}
      x={0}
      y={0}
      width={width}
      height={height}
      fit="contain"
    />
  );
}

export function EditorCanvas({
  project,
  selectedIds,
  tapPoint,
  onTapResult,
}: EditorCanvasProps) {
  const [view, setView] = useState<{ w: number; h: number } | null>(null);

  /**
   * The canvas is sized by the plain `View` wrapper below, never by `<Canvas>`
   * itself: Skia dropped `onLayout` on the new architecture (Fabric), where the
   * prop is ignored and only logs an error. Measuring the wrapper is equivalent
   * — the Canvas fills it — and without a size the fit-to-view math below would
   * stay at `scale: 1` and paint the design 1:1 from the top-left corner.
   */
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    const h = e.nativeEvent.layout.height;
    // `onLayout` re-fires with the same box on unrelated layout passes;
    // returning the previous object keeps the fit memo and the viewport effect
    // from re-running (and re-rendering every object) for no reason.
    setView((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
  }, []);

  const textObjects = useMemo(
    () =>
      project.objects.filter(
        (o): o is Extract<DesignObject, { type: 'text' }> => o.type === 'text',
      ),
    [project.objects],
  );
  const layouts = useTextLayouts(textObjects, project.canvas.width);

  const sized = useMemo<SizedObject[]>(
    () =>
      project.objects.map((obj) => ({
        id: obj.id,
        groupId: obj.groupId,
        transform: obj.transform,
        zIndex: obj.zIndex,
        box: objectBox(obj, layouts),
        // Only a split word's part hugs its ink: its advance/line box is far
        // wider than the letter, so hit-testing and the chrome would overlap the
        // neighbours. Every other object keeps the box it always had.
        ink:
          obj.type === 'text' && obj.part !== undefined
            ? layouts[obj.id]?.ink
            : undefined,
      })),
    [project.objects, layouts],
  );

  // Report sized objects to the store so gesture closures can hit-test.
  //
  // Laid out *before paint* on purpose. A drag frame publishes the new boxes in
  // this commit; published in a passive effect the collection bar re-rendered a
  // frame later, so the "Group · N" label visibly trailed the objects it labels.
  // A layout effect makes the bar's repositioning land in the same painted frame.
  useLayoutEffect(() => {
    useEditorStore.getState().setSizedObjects(sized);
  }, [sized]);

  // Fit-to-view: scale the design canvas down/up to fill the available view,
  // centered. The same mapping is stored for gesture coordinate conversion.
  const { scale, offsetX, offsetY } = useMemo(() => {
    if (!view || view.w === 0 || view.h === 0) {
      return { scale: 1, offsetX: 0, offsetY: 0 };
    }
    const s = Math.min(
      view.w / project.canvas.width,
      view.h / project.canvas.height,
    );
    return {
      scale: s,
      offsetX: (view.w - project.canvas.width * s) / 2,
      offsetY: (view.h - project.canvas.height * s) / 2,
    };
  }, [view, project.canvas.width, project.canvas.height]);

  useEffect(() => {
    useEditorStore.getState().setViewport({
      scale,
      offsetX,
      offsetY,
      w: view?.w ?? 0,
      h: view?.h ?? 0,
    });
  }, [scale, offsetX, offsetY, view]);

  // Latest values for the tap effect below. `sized` gets a new identity on
  // every drag frame and `onTapResult` on most screen renders; keying the
  // effect on `tapPoint` alone makes it fire exactly once per real tap
  // instead of looping a hit-test + selection write on every frame.
  const sizedRef = useRef(sized);
  const onTapResultRef = useRef(onTapResult);
  // The grab tolerance is authored in screen pt, so the hit-test needs the live
  // view scale — through a ref, because keying the tap effect on it would re-run
  // the hit-test on every rotation.
  const scaleRef = useRef(scale);
  useEffect(() => {
    sizedRef.current = sized;
  }, [sized]);
  useEffect(() => {
    onTapResultRef.current = onTapResult;
  }, [onTapResult]);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Resolve a tap into a selection (effect, not render-time side effect).
  useEffect(() => {
    if (tapPoint) {
      onTapResultRef.current?.(
        hitTest(sizedRef.current, tapPoint.x, tapPoint.y, scaleRef.current),
      );
    }
  }, [tapPoint]);

  /**
   * The box around the selection, and what kind of box it is.
   *
   * One rule, shared with the gesture layer and the collection bar (`groups.ts`): a
   * whole selection is a box with handles, an entered member shows its collection's
   * box as context, and a lone object has no box of its own at all. What is drawn,
   * what is labelled and what can be grabbed are therefore the same box.
   */
  const selection = useMemo(
    () => selectionFrame(selectedIds, sized),
    [selectedIds, sized],
  );

  // Draw order, front-to-back. Keeps the RAW object references from
  // `project.objects` (the store preserves them for untouched objects during a
  // drag), so each `ObjectLayer`'s memo can bail out for every object that did
  // not move — only the dragged object re-renders per frame.
  const sortedObjects = useMemo(
    () => [...project.objects].sort((a, b) => a.zIndex - b.zIndex),
    [project.objects],
  );

  const { width, height } = project.canvas;
  const bg = project.canvas.background;
  const paperColor = bg.type === 'paper' ? (bg.color ?? '#F7F6F3') : '#FFFFFF';

  return (
    <View style={styles.canvas} onLayout={onLayout}>
      <Canvas style={styles.canvas}>
        <Group
          transform={[
            { translateX: offsetX },
            { translateY: offsetY },
            { scale },
          ]}
        >
          {/* Background */}
          {bg.type === 'image' && bg.imageUri ? (
            <BackgroundImage uri={bg.imageUri} width={width} height={height} />
          ) : (
            <Rect
              x={0}
              y={0}
              width={width}
              height={height}
              color={bg.type === 'transparent' ? 'transparent' : paperColor}
            />
          )}

          {/* Grid */}
          {project.gridEnabled && (
            <GridOverlay width={width} height={height} scale={scale} />
          )}

          {/* Objects */}
          {sortedObjects.map((obj) => (
            <ObjectLayer
              key={obj.id}
              obj={obj}
              layouts={layouts}
              scale={scale}
              isSelected={
                selectedIds.length === 1 && selectedIds.includes(obj.id)
              }
            />
          ))}
          {selection && (
            <CollectionOverlay
              frame={selection.frame}
              scale={scale}
              handles={selection.state === 'whole'}
            />
          )}
        </Group>
      </Canvas>
    </View>
  );
}

/**
 * One object's transform group + content + selection chrome.
 *
 * Memoized on the RAW object reference: the store preserves the reference of
 * every untouched object during a drag, so only the object being moved,
 * resized or rotated re-renders per frame. `box`/`paragraph` are derived
 * inside from `obj` + `layouts` (both stable for untouched objects), so the
 * memo's shallow compare stays effective.
 */
const ObjectLayer = memo(function ObjectLayer({
  obj,
  layouts,
  scale,
  isSelected,
}: {
  obj: DesignObject;
  layouts: TextLayouts;
  scale: number;
  isSelected: boolean;
}) {
  const box = useMemo(() => objectBox(obj, layouts), [obj, layouts]);
  const paragraph = useMemo(
    () => (obj.type === 'text' ? layouts[obj.id]?.paragraph : undefined),
    [obj, layouts],
  );
  // The chrome hugs the ink for a split part; otherwise the object's own box.
  const chrome = useMemo(() => {
    const ink =
      obj.type === 'text' && obj.part !== undefined
        ? layouts[obj.id]?.ink
        : undefined;
    return ink ?? { cx: 0, cy: 0, width: box.width, height: box.height };
  }, [obj, layouts, box]);
  const t = obj.transform;
  const rot = (t.rotation * Math.PI) / 180;
  const scaleX = t.flipH ? -t.scale : t.scale;
  const scaleY = t.flipV ? -t.scale : t.scale;
  const content =
    obj.type === 'text' && paragraph ? (
      <Paragraph
        paragraph={paragraph}
        x={-box.width / 2}
        y={-box.height / 2}
        width={box.width}
      />
    ) : obj.type === 'image' ? (
      // A placed image fills its own box, so it needs no `-box/2` translate the
      // way the shape and glyph renderers do — `PlacedImage` draws at 0,0 and the
      // caller's box is already the object's frame.
      <PlacedImage uri={obj.imageUri} width={box.width} height={box.height} />
    ) : obj.type === 'shape' ? (
      // Renderers draw into a 0..size box, so shift it to sit centred on
      // the object origin — which is what the overlay and hit-test assume.
      <Group
        transform={[
          { translateX: -box.width / 2 },
          { translateY: -box.height / 2 },
        ]}
      >
        <ShapeRenderer shape={obj} size={box.width} />
      </Group>
    ) : obj.type === 'glyph' ? (
      <Group
        transform={[
          { translateX: -box.width / 2 },
          { translateY: -box.height / 2 },
        ]}
      >
        <GlyphRenderer glyph={obj} size={box.width} />
      </Group>
    ) : null;
  // Fading happens on a nested group so the object's selection chrome
  // stays fully opaque. Skipped at full opacity to avoid paying for an
  // offscreen layer on every object.
  const opacity = obj.opacity ?? 1;
  return (
    <Group
      transform={[
        { translateX: t.x },
        { translateY: t.y },
        { rotate: rot },
        { scaleX },
        { scaleY },
      ]}
      origin={vec(0, 0)}
    >
      {opacity < 1 ? <Group opacity={opacity}>{content}</Group> : content}
      {isSelected && (
        <SelectionOverlay
          box={chrome}
          scale={scale}
          objectScale={Math.abs(t.scale) || 1}
        />
      )}
    </Group>
  );
});

/**
 * The box, handles and rotate grip around a whole selection.
 *
 * Drawn as a *sibling* of the objects, inside the fit group, because a collection
 * has no transform of its own to nest the chrome inside — which is also why every
 * length below divides by the view scale alone, unlike `SelectionOverlay`, which
 * lives inside one object's transform and has to divide out that object's scale
 * too.
 *
 * `handles: false` is the entered state: the frame stays as context for what the
 * selected member belongs to, and the member's own chrome carries the handles.
 */
const CollectionOverlay = memo(function CollectionOverlay({
  frame,
  scale,
  handles,
}: {
  frame: CollectionFrame;
  scale: number;
  handles: boolean;
}) {
  const box = frameBox(frame);
  // The frame has no transform of its own, so the view scale alone maps these
  // units to the screen. Every length below is a screen pt that `unit` divides
  // back out — including the pad and the grip gap, which used to be left in
  // design units and so collapsed onto the box edge on a phone.
  const unit = scale;
  const pad = selectionPad(unit);
  const hw = box.width / 2 + pad;
  const hh = box.height / 2 + pad;
  const border = 1.5 / unit;
  const handleR = 5 / unit;
  const gripR = ROTATE_GRIP_RADIUS / unit;
  const positions = resizeHandles(box, unit);
  const grip = rotateHandle(box, unit);
  return (
    <Group
      transform={[
        { translateX: frame.x },
        { translateY: frame.y },
        { rotate: (frame.rotation * Math.PI) / 180 },
      ]}
      origin={vec(0, 0)}
    >
      <Rect
        x={-hw}
        y={-hh}
        width={box.width + pad * 2}
        height={box.height + pad * 2}
        color="transparent"
        style="stroke"
        strokeWidth={border}
      >
        <DashPathEffect intervals={[6 / unit, 5 / unit]} />
      </Rect>
      {handles &&
        positions.map((p) => (
          <Circle
            key={p.handle}
            c={vec(p.x, p.y)}
            r={handleR}
            color="#111111"
            style="stroke"
            strokeWidth={2 / unit}
          />
        ))}
      {handles &&
        positions.map((p) => (
          <Circle
            key={`c${p.handle}`}
            c={vec(p.x, p.y)}
            r={handleR}
            color="#FFFFFF"
          />
        ))}
      {handles && (
        <>
          <Line
            p1={vec(0, -hh)}
            p2={vec(grip.x, grip.y)}
            color="#111111"
            strokeWidth={border}
          />
          <Circle
            c={vec(grip.x, grip.y)}
            r={gripR}
            color="#111111"
            style="stroke"
            strokeWidth={2 / unit}
          />
          <Circle c={vec(grip.x, grip.y)} r={gripR} color="#FFFFFF" />
        </>
      )}
    </Group>
  );
});

const GridOverlay = memo(function GridOverlay({
  width,
  height,
  scale,
}: {
  width: number;
  height: number;
  scale: number;
}) {
  const lines = useMemo(() => {
    const arr = [];
    const step = 40;
    for (let i = 1; i <= Math.floor(width / step); i++) {
      arr.push(
        <Line
          key={`v${i}`}
          p1={vec(i * step, 0)}
          p2={vec(i * step, height)}
          color="rgba(0,0,0,0.08)"
          strokeWidth={1 / scale}
        />,
      );
    }
    for (let j = 1; j <= Math.floor(height / step); j++) {
      arr.push(
        <Line
          key={`h${j}`}
          p1={vec(0, j * step)}
          p2={vec(width, j * step)}
          color="rgba(0,0,0,0.08)"
          strokeWidth={1 / scale}
        />,
      );
    }
    return arr;
  }, [width, height, scale]);
  return <Group>{lines}</Group>;
});

/**
 * Dashed selection outline, eight resize handles, and a rotation grip around
 * an object's bounding box. Drawn inside the object's own transform group so it
 * rotates/flips with the object. Handles come from the shared geometry helpers
 * so the overlay and the gesture hit-test always agree: corners scale
 * proportionally, east/west edges re-flow text width, north/south edges scale
 * the text size, and the grip above the top edge rotates about the centre.
 */
const SelectionOverlay = memo(function SelectionOverlay({
  box,
  scale,
  objectScale,
}: {
  box: { cx: number; cy: number; width: number; height: number };
  scale: number;
  objectScale: number;
}) {
  // Drawn *inside* the object's transform group, so every length below is
  // multiplied by the object's own scale on the way to the screen — on top of
  // the view scale. `unit` is both of them together, and every length is a
  // screen pt divided by it: the pad and the grip gap (through the shared
  // geometry helpers), the strokes and the radii. Dividing by `scale` alone
  // only covered the view zoom, which is why the handles used to grow with the
  // object and the grip used to sit on its border.
  const unit = scale * safeObjectScale(objectScale);
  const chromePad = selectionPad(unit);
  const pad = chromePad * 2;
  const { cx, cy, width, height } = box;
  const hw = width / 2 + chromePad;
  const hh = height / 2 + chromePad;
  const border = 1.5 / unit;
  const handleR = 5 / unit;
  const gripR = ROTATE_GRIP_RADIUS / unit;
  const positions = resizeHandles({ width, height }, unit);
  const grip = rotateHandle({ width, height }, unit);
  return (
    // The ink box is not centred on the object origin, so the whole chrome is
    // translated to the ink centre — the gestures offset their press by the same
    // vector, so what is drawn is what is grabbed.
    <Group transform={[{ translateX: cx }, { translateY: cy }]}>
      <Rect
        x={-hw}
        y={-hh}
        width={width + pad}
        height={height + pad}
        color="transparent"
        style="stroke"
        strokeWidth={border}
      >
        <DashPathEffect intervals={[6 / unit, 5 / unit]} />
      </Rect>
      {positions.map((p) => (
        <Circle
          key={p.handle}
          c={vec(p.x, p.y)}
          r={handleR}
          color="#111111"
          style="stroke"
          strokeWidth={2 / unit}
        />
      ))}
      {positions.map((p) => (
        <Circle
          key={`c${p.handle}`}
          c={vec(p.x, p.y)}
          r={handleR}
          color="#FFFFFF"
        />
      ))}
      {/* Rotation grip, on a short stalk above the box's top edge */}
      <Line
        p1={vec(0, -hh)}
        p2={vec(grip.x, grip.y)}
        color="#111111"
        strokeWidth={border}
      />
      <Circle
        c={vec(grip.x, grip.y)}
        r={gripR}
        color="#111111"
        style="stroke"
        strokeWidth={2 / unit}
      />
      <Circle c={vec(grip.x, grip.y)} r={gripR} color="#FFFFFF" />
    </Group>
  );
});

const styles = StyleSheet.create({
  canvas: { flex: 1 },
});
