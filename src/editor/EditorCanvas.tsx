import {
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Line,
  Paragraph,
  Rect,
  vec,
} from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";

import {
  groupAabb,
  hitTest,
  resizeHandles,
  rotateHandle,
  safeObjectScale,
  selectionPad,
  type Aabb,
  type SizedObject,
} from "@/editor/hit-test";
import { GlyphRenderer } from "@/editor/skia/glyph-shape";
import { SHAPE_BASE_SIZE } from "@/editor/skia/shape-geometry";
import { ShapeRenderer } from "@/editor/skia/shapes";
import { textObjectSize, useTextLayouts } from "@/editor/skia/use-text-layouts";
import { useEditorStore } from "@/editor/store";
import type { DesignObject, MidadProject } from "@/storage/project-schema";

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
    case "text": {
      const layout = layouts[obj.id];
      return textObjectSize(layout, obj.fontSize, obj.wrapWidth);
    }
    case "shape":
    case "glyph":
      // Local (unscaled) box. The object's transform group supplies the scale,
      // so including it here would apply it twice.
      return { width: SHAPE_BASE_SIZE, height: SHAPE_BASE_SIZE };
  }
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
        (o): o is Extract<DesignObject, { type: "text" }> => o.type === "text",
      ),
    [project.objects],
  );
  const layouts = useTextLayouts(textObjects, project.canvas.width);

  const sized = useMemo<SizedObject[]>(
    () =>
      project.objects.map((obj) => ({
        id: obj.id,
        transform: obj.transform,
        zIndex: obj.zIndex,
        box: objectBox(obj, layouts),
      })),
    [project.objects, layouts],
  );

  // Report sized objects to the store so gesture closures can hit-test.
  useEffect(() => {
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
    useEditorStore.getState().setViewport({ scale, offsetX, offsetY });
  }, [scale, offsetX, offsetY]);

  // Resolve a tap into a selection (effect, not render-time side effect).
  useEffect(() => {
    if (tapPoint && onTapResult) {
      onTapResult(hitTest(sized, tapPoint.x, tapPoint.y));
    }
  }, [tapPoint, sized, onTapResult]);

  const groupBox = useMemo(
    () =>
      selectedIds.length > 1
        ? groupAabb(sized.filter((o) => selectedIds.includes(o.id)))
        : null,
    [selectedIds, sized],
  );

  const objects = useMemo(
    () =>
      project.objects
        .map((obj) => ({
          ...obj,
          box: objectBox(obj, layouts),
          paragraph:
            obj.type === "text" ? layouts[obj.id]?.paragraph : undefined,
        }))
        .sort((a, b) => a.zIndex - b.zIndex),
    [project.objects, layouts],
  );

  const { width, height } = project.canvas;
  const bg = project.canvas.background;
  const paperColor = bg.type === "paper" ? (bg.color ?? "#F7F6F3") : "#FFFFFF";

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
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            color={bg.type === "transparent" ? "transparent" : paperColor}
          />

          {/* Grid */}
          {project.gridEnabled && (
            <GridOverlay width={width} height={height} scale={scale} />
          )}

          {/* Objects */}
          {objects.map((obj) => {
            const t = obj.transform;
            const rot = (t.rotation * Math.PI) / 180;
            const scaleX = t.flipH ? -t.scale : t.scale;
            const scaleY = t.flipV ? -t.scale : t.scale;
            const content =
              obj.type === "text" && obj.paragraph ? (
                <Paragraph
                  paragraph={obj.paragraph}
                  x={-obj.box.width / 2}
                  y={-obj.box.height / 2}
                  width={obj.box.width}
                />
              ) : obj.type === "shape" ? (
                // Renderers draw into a 0..size box, so shift it to sit centred on
                // the object origin — which is what the overlay and hit-test assume.
                <Group
                  transform={[
                    { translateX: -obj.box.width / 2 },
                    { translateY: -obj.box.height / 2 },
                  ]}
                >
                  <ShapeRenderer shape={obj} size={obj.box.width} />
                </Group>
              ) : obj.type === "glyph" ? (
                <Group
                  transform={[
                    { translateX: -obj.box.width / 2 },
                    { translateY: -obj.box.height / 2 },
                  ]}
                >
                  <GlyphRenderer glyph={obj} size={obj.box.width} />
                </Group>
              ) : null;
            // Fading happens on a nested group so the object's selection chrome
            // stays fully opaque. Skipped at full opacity to avoid paying for an
            // offscreen layer on every object.
            const opacity = obj.opacity ?? 1;
            return (
              <Group
                key={obj.id}
                transform={[
                  { translateX: t.x },
                  { translateY: t.y },
                  { rotate: rot },
                  { scaleX },
                  { scaleY },
                ]}
                origin={vec(0, 0)}
              >
                {opacity < 1 ? (
                  <Group opacity={opacity}>{content}</Group>
                ) : (
                  content
                )}
                {selectedIds.length === 1 && selectedIds.includes(obj.id) && (
                  <SelectionOverlay
                    box={obj.box}
                    scale={scale}
                    objectScale={Math.abs(t.scale) || 1}
                  />
                )}
              </Group>
            );
          })}
          {groupBox && <GroupSelectionOverlay box={groupBox} scale={scale} />}
        </Group>
      </Canvas>
    </View>
  );
}

function GroupSelectionOverlay({ box, scale }: { box: Aabb; scale: number }) {
  const border = 1.5 / scale;
  return (
    <Rect
      x={box.left}
      y={box.top}
      width={box.right - box.left}
      height={box.bottom - box.top}
      color="transparent"
      style="stroke"
      strokeWidth={border}
    >
      <DashPathEffect intervals={[6 / scale, 5 / scale]} />
    </Rect>
  );
}

function GridOverlay({
  width,
  height,
  scale,
}: {
  width: number;
  height: number;
  scale: number;
}) {
  const step = 40;
  const lines = [];
  for (let i = 1; i <= Math.floor(width / step); i++) {
    lines.push(
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
    lines.push(
      <Line
        key={`h${j}`}
        p1={vec(0, j * step)}
        p2={vec(width, j * step)}
        color="rgba(0,0,0,0.08)"
        strokeWidth={1 / scale}
      />,
    );
  }
  return <Group>{lines}</Group>;
}

/**
 * Dashed selection outline, eight resize handles, and a rotation grip around
 * an object's bounding box. Drawn inside the object's own transform group so it
 * rotates/flips with the object. Handles come from the shared geometry helpers
 * so the overlay and the gesture hit-test always agree: corners scale
 * proportionally, east/west edges re-flow text width, north/south edges scale
 * the text size, and the grip above the top edge rotates about the centre.
 */
function SelectionOverlay({
  box,
  scale,
  objectScale,
}: {
  box: { width: number; height: number };
  scale: number;
  objectScale: number;
}) {
  const chromePad = selectionPad(objectScale);
  const pad = chromePad * 2;
  const hw = box.width / 2 + chromePad;
  const hh = box.height / 2 + chromePad;
  // Drawn *inside* the object's transform group, so every length below is
  // multiplied by the object's own scale on the way to the screen. `chromePad`
  // already divides that out; the strokes and radii have to do the same or the
  // handles and the rotate grip grow along with the object — and shrink away on
  // a scaled-down one. Dividing by `scale` alone only covers the view zoom.
  const unit = scale * safeObjectScale(objectScale);
  const border = 1.5 / unit;
  const handleR = 4 / unit;
  const gripR = 5 / unit;
  const positions = resizeHandles(box, objectScale);
  const grip = rotateHandle(box, objectScale);
  return (
    <Group>
      <Rect
        x={-hw}
        y={-hh}
        width={box.width + pad}
        height={box.height + pad}
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
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
});
