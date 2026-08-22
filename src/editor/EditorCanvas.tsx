import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import {
  Canvas,
  Group,
  Line,
  Paragraph,
  Rect,
  vec,
} from '@shopify/react-native-skia';

import { useTextLayouts, textObjectSize } from '@/editor/skia/use-text-layouts';
import { SHAPE_BASE_SIZE } from '@/editor/skia/shape-geometry';
import { ShapeRenderer } from '@/editor/skia/shapes';
import { hitTest, type SizedObject } from '@/editor/hit-test';
import { useEditorStore } from '@/editor/store';
import type { DesignObject, MidadProject } from '@/storage/project-schema';

export interface EditorCanvasProps {
  project: MidadProject;
  selectedIds: string[];
  /** Hit-test target point (design units); triggers selection changes. */
  tapPoint?: { x: number; y: number } | null;
  onTapResult?: (id: string | null) => void;
}

function objectBox(obj: DesignObject, layouts: ReturnType<typeof useTextLayouts>): { width: number; height: number } {
  switch (obj.type) {
    case 'text': {
      const layout = layouts[obj.id];
      return textObjectSize(layout, obj.fontSize);
    }
    case 'shape':
    case 'glyph': {
      const base = SHAPE_BASE_SIZE * (obj.transform.scale || 1);
      return { width: base, height: base };
    }
  }
}

export function EditorCanvas({ project, selectedIds, tapPoint, onTapResult }: EditorCanvasProps) {
  const [view, setView] = useState<{ w: number; h: number } | null>(null);
  const textObjects = useMemo(
    () => project.objects.filter((o): o is Extract<DesignObject, { type: 'text' }> => o.type === 'text'),
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
    const s = Math.min(view.w / project.canvas.width, view.h / project.canvas.height);
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

  const objects = useMemo(
    () =>
      project.objects
        .map((obj) => ({
          ...obj,
          box: objectBox(obj, layouts),
          paragraph: obj.type === 'text' ? layouts[obj.id]?.paragraph : undefined,
        }))
        .sort((a, b) => a.zIndex - b.zIndex),
    [project.objects, layouts],
  );

  const { width, height } = project.canvas;
  const bg = project.canvas.background;
  const paperColor = bg.type === 'paper' ? bg.color ?? '#F7F6F3' : '#FFFFFF';

  return (
    <Canvas style={styles.canvas} onLayout={(e) => setView({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Group transform={[{ translateX: offsetX }, { translateY: offsetY }, { scale }]}>
        {/* Background */}
        <Rect x={0} y={0} width={width} height={height} color={bg.type === 'transparent' ? 'transparent' : paperColor} />

        {/* Grid */}
        {project.gridEnabled && <GridOverlay width={width} height={height} scale={scale} />}

        {/* Objects */}
        {objects.map((obj) => {
          const t = obj.transform;
          const rot = (t.rotation * Math.PI) / 180;
          const scaleX = t.flipH ? -t.scale : t.scale;
          const scaleY = t.flipV ? -t.scale : t.scale;
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
              origin={vec(0, 0)}>
              {obj.type === 'text' && obj.paragraph ? (
                <Paragraph paragraph={obj.paragraph} x={-obj.box.width / 2} y={-obj.box.height / 2} width={obj.box.width} />
              ) : obj.type === 'shape' ? (
                <Group origin={vec(-obj.box.width / 2, -obj.box.height / 2)}>
                  <ShapeRenderer shape={obj} size={obj.box.width} />
                </Group>
              ) : null}
              {selectedIds.includes(obj.id) && (
                <Rect
                  x={-obj.box.width / 2 - 4}
                  y={-obj.box.height / 2 - 4}
                  width={obj.box.width + 8}
                  height={obj.box.height + 8}
                  color="transparent"
                  style="stroke"
                  strokeWidth={1.5 / scale}
                />
              )}
            </Group>
          );
        })}
      </Group>
    </Canvas>
  );
}

function GridOverlay({ width, height, scale }: { width: number; height: number; scale: number }) {
  const step = 40;
  const lines = [];
  for (let i = 1; i <= Math.floor(width / step); i++) {
    lines.push(<Line key={`v${i}`} p1={vec(i * step, 0)} p2={vec(i * step, height)} color="rgba(0,0,0,0.08)" strokeWidth={1 / scale} />);
  }
  for (let j = 1; j <= Math.floor(height / step); j++) {
    lines.push(<Line key={`h${j}`} p1={vec(0, j * step)} p2={vec(width, j * step)} color="rgba(0,0,0,0.08)" strokeWidth={1 / scale} />);
  }
  return <Group>{lines}</Group>;
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
});