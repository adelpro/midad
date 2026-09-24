/**
 * Ornament and shape library — the only surface that creates a decoration.
 *
 * Both kinds render into a `SHAPE_BASE_SIZE` box and carry their real size in
 * `transform.scale`, so a tile tap maps straight onto one object at the canvas
 * centre; the sheet then closes and the caller returns the rail to Select.
 *
 * Thumbnails are drawn with `react-native-svg` rather than Skia. The catalogue
 * holds plain SVG path data in font units with Y already negated, which is
 * exactly what `<Svg viewBox>` wants, and `@/editor/glyphs` is deliberately
 * Skia-free so a modal never drags CanvasKit onto its render path.
 */
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { Button, Sheet } from '@/components/ui';
import {
  glyphStrokeWidth,
  glyphViewBox,
  glyphsInGroup,
  type GlyphCatalogEntry,
  type GlyphGroup,
} from '@/editor/glyphs';
import {
  SHAPE_BASE_SIZE,
  SHAPE_INSET,
  SHAPE_PATH_BUILDERS,
} from '@/editor/skia/shape-geometry';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import type { ShapeKey } from '@/storage/project-schema';
import { fontRoles, radius, spacing, typeScale } from '@/theme';

export type InsertTab = 'glyphs' | 'shapes';

/** Re-exported so callers can name a shape without reaching into the schema. */
export type { ShapeKey };

/** Shapes in the order the sheet lists them: boxes, polygons, then curves. */
const SHAPE_KEYS: readonly ShapeKey[] = [
  'circle',
  'square',
  'triangle',
  'diamond',
  'pentagon',
  'hexagon',
  'octagon',
  'star',
  'crescent',
  'arch',
  'ring',
  'line',
];

/** Catalogue groups in the order the sheet lists them. */
const GROUPS: readonly GlyphGroup[] = ['mark', 'letter'];

/** Tile metrics (dp). */
const TILE = 76;
const PREVIEW = 44;
/**
 * Stroke width for shapes, in the renderer's base units. `ShapeRenderer` doubles
 * it for `ring` and `line`, so the previews below do the same — the tile shows
 * what will actually land on the canvas.
 */
const SHAPE_STROKE = 4;
/** Share of the window the scrolling ornament grid may occupy. */
const GRID_MAX_FRACTION = 0.42;

export interface InsertSheetProps {
  visible: boolean;
  onClose: () => void;
  onPickGlyph: (glyphKey: string) => void;
  onPickShape: (shapeKey: ShapeKey) => void;
}

/**
 * Mirrors `ShapeRenderer` inside the base box. The enclosing `<Svg>` supplies
 * the scale, so every coordinate here is in design units and nothing can
 * disagree with the canvas.
 */
function ShapePreview({
  shapeKey,
  color,
}: {
  shapeKey: ShapeKey;
  color: string;
}) {
  const size = SHAPE_BASE_SIZE;
  const mid = size / 2;
  const thin = SHAPE_STROKE;
  const thick = SHAPE_STROKE * 2;
  switch (shapeKey) {
    case 'circle':
      return (
        <Circle
          cx={mid}
          cy={mid}
          r={mid - SHAPE_INSET}
          fill="none"
          stroke={color}
          strokeWidth={thin}
        />
      );
    case 'square':
      return (
        <Rect
          x={SHAPE_INSET}
          y={SHAPE_INSET}
          width={size - SHAPE_INSET * 2}
          height={size - SHAPE_INSET * 2}
          fill="none"
          stroke={color}
          strokeWidth={thin}
        />
      );
    case 'ring':
      return (
        <Circle
          cx={mid}
          cy={mid}
          r={size / 3}
          fill="none"
          stroke={color}
          strokeWidth={thick}
        />
      );
    case 'line':
      return (
        <Line
          x1={2}
          y1={mid}
          x2={size - 2}
          y2={mid}
          stroke={color}
          strokeWidth={thick}
          strokeLinecap="round"
        />
      );
    default: {
      // The same table the canvas and both exporters read, so a tile is always a
      // faithful preview of the object it inserts.
      const build = SHAPE_PATH_BUILDERS[shapeKey];
      if (!build) {
        return null;
      }
      return (
        <Path
          d={build(size)}
          fill="none"
          stroke={color}
          strokeWidth={thin}
          strokeLinejoin="round"
        />
      );
    }
  }
}

/**
 * One ornament thumbnail.
 *
 * The `viewBox` is the glyph's padded ink box, so the ink fills the tile at any
 * aspect ratio — the same letterboxing `glyphPlacement` applies on the canvas.
 * Glyphs paint as line-art (`stroke` over the font-unit path, at the shared
 * `glyphStrokeWidth`), matching `GlyphRenderer` so a tile previews its object.
 */
function GlyphTile({
  entry,
  label,
  onPress,
}: {
  entry: GlyphCatalogEntry;
  label: string;
  onPress: () => void;
}) {
  const { colors: c } = useTheme();
  const { language } = useT();
  const fonts = fontRoles[language];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: pressed ? c.surfacePressed : c.surfaceAlt,
          borderColor: c.border,
        },
      ]}
    >
      <Svg width={PREVIEW} height={PREVIEW} viewBox={glyphViewBox(entry)}>
        <Path
          d={entry.d}
          fill="none"
          stroke={c.ink}
          strokeWidth={glyphStrokeWidth(entry)}
          strokeLinejoin="round"
        />
      </Svg>
      <Text
        numberOfLines={1}
        style={[styles.tileLabel, { color: c.muted, fontFamily: fonts.ui }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** One shape thumbnail, drawn through the same geometry as the canvas. */
function ShapeTile({
  shapeKey,
  label,
  onPress,
}: {
  shapeKey: ShapeKey;
  label: string;
  onPress: () => void;
}) {
  const { colors: c } = useTheme();
  const { language } = useT();
  const fonts = fontRoles[language];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: pressed ? c.surfacePressed : c.surfaceAlt,
          borderColor: c.border,
        },
      ]}
    >
      <Svg
        width={PREVIEW}
        height={PREVIEW}
        viewBox={`0 0 ${SHAPE_BASE_SIZE} ${SHAPE_BASE_SIZE}`}
      >
        <ShapePreview shapeKey={shapeKey} color={c.ink} />
      </Svg>
      <Text
        numberOfLines={1}
        style={[styles.tileLabel, { color: c.muted, fontFamily: fonts.ui }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The library. Tabs rather than two rail buttons: the rail already carries five
 * captions and both families share one grid, one tile size and one insert path.
 */
export function InsertSheet({
  visible,
  onClose,
  onPickGlyph,
  onPickShape,
}: InsertSheetProps) {
  const { colors: c } = useTheme();
  const { t, language } = useT();
  const { height } = useWindowDimensions();
  const [tab, setTab] = useState<InsertTab>('glyphs');
  const fonts = fontRoles[language];

  const shapeLabels: Record<ShapeKey, string> = {
    circle: t.editor.shapeCircle,
    square: t.editor.shapeSquare,
    line: t.editor.shapeLine,
    star: t.editor.shapeStar,
    triangle: t.editor.shapeTriangle,
    ring: t.editor.shapeRing,
    diamond: t.editor.shapeDiamond,
    pentagon: t.editor.shapePentagon,
    hexagon: t.editor.shapeHexagon,
    octagon: t.editor.shapeOctagon,
    crescent: t.editor.shapeCrescent,
    arch: t.editor.shapeArch,
  };

  /**
   * Close before handing the key over, so the exit spring starts on the same
   * frame the object is created and the sheet is already leaving when the
   * decoration appears behind it.
   */
  const pick = (run: () => void) => () => {
    onClose();
    run();
  };

  return (
    // Modal on web: `Sheet` only enables its drag-to-dismiss pan for the bottom
    // presentation, and that pan would otherwise steal vertical drags from the
    // scrolling grid — dragging the list would slide the whole sheet down. The
    // centered modal has no such gesture, so the `ScrollView` owns them (the
    // same reason `help-sheet.tsx` and the two pickers are modals on web).
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t.editor.glyphs}
      closeButton
      presentation={Platform.OS === 'web' ? 'modal' : 'bottom'}
    >
      <View style={styles.body}>
        <View style={styles.tabs}>
          <Button
            label={t.editor.glyphs}
            variant={tab === 'glyphs' ? 'primary' : 'secondary'}
            selected={tab === 'glyphs'}
            onPress={() => setTab('glyphs')}
            style={styles.tab}
          />
          <Button
            label={t.editor.shapes}
            variant={tab === 'shapes' ? 'primary' : 'secondary'}
            selected={tab === 'shapes'}
            onPress={() => setTab('shapes')}
            style={styles.tab}
          />
        </View>

        {tab === 'glyphs' ? (
          <ScrollView
            style={{ maxHeight: Math.round(height * GRID_MAX_FRACTION) }}
            contentContainerStyle={styles.sections}
          >
            {GROUPS.map((group) => (
              <View key={group} style={styles.section}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: c.muted, fontFamily: fonts.uiBold },
                  ]}
                >
                  {group === 'mark'
                    ? t.editor.glyphMarks
                    : t.editor.glyphLetters}
                </Text>
                <View style={styles.grid}>
                  {glyphsInGroup(group).map((entry) => (
                    <GlyphTile
                      key={entry.key}
                      entry={entry}
                      label={language === 'ar' ? entry.labelAr : entry.labelEn}
                      onPress={pick(() => onPickGlyph(entry.key))}
                    />
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.grid}>
            {SHAPE_KEYS.map((key) => (
              <ShapeTile
                key={key}
                shapeKey={key}
                label={shapeLabels[key]}
                onPress={pick(() => onPickShape(key))}
              />
            ))}
          </View>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  tabs: { flexDirection: 'row', gap: spacing.xs },
  tab: { flex: 1 },
  sections: { gap: spacing.lg },
  section: { gap: spacing.xs },
  // No `uppercase` or extra tracking here: both are Latin-only conventions and
  // they mangle Arabic. See the theme's typography rules.
  sectionTitle: { fontSize: typeScale.caption.size },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  tile: {
    width: TILE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  tileLabel: { fontSize: typeScale.caption.size, textAlign: 'center' },
});
