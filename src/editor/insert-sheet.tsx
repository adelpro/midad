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
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { AnimatedPressable, Button, Sheet } from '@/components/ui';
import {
  GLYPH_DEFAULT_STYLE,
  glyphStrokeWidth,
  glyphViewBox,
  glyphsInGroup,
  type GlyphCatalogEntry,
  type GlyphGroup,
  type GlyphStyle,
} from '@/editor/glyphs';
import {
  SHAPE_BASE_SIZE,
  SHAPE_INSET,
  SHAPE_PATH_BUILDERS,
} from '@/editor/skia/shape-geometry';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { searchIcons, type IconSearchHit } from '@/storage/icon-search';
import type { ShapeKey } from '@/storage/project-schema';
import { fontRoles, radius, spacing, typeScale } from '@/theme';

export type InsertTab = 'glyphs' | 'shapes' | 'media';

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
/** Debounce before the icon catalogue is queried per keystroke. */
const ICON_SEARCH_DEBOUNCE_MS = 250;

type IconSearchState = 'idle' | 'loading' | 'ready' | 'error';

export interface InsertSheetProps {
  visible: boolean;
  onClose: () => void;
  onPickGlyph: (glyphKey: string, style: GlyphStyle) => void;
  onPickShape: (shapeKey: ShapeKey) => void;
  /** Opens the photo library to place an image on the canvas. */
  onPickImage: () => void;
  /** Resolves a search hit to geometry and places it. Rejects are the caller's. */
  onPickIcon: (hit: IconSearchHit) => void;
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
 * The paint follows the picker's `style` the same way `GlyphRenderer` follows
 * the object's: `solid` fills the outline, `outline`/`thin` stroke it at the
 * shared `glyphStrokeWidth`, so a tile previews its object.
 */
function GlyphTile({
  entry,
  style,
  label,
  onPress,
}: {
  entry: GlyphCatalogEntry;
  style: GlyphStyle;
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
        {style === 'solid' ? (
          <Path d={entry.d} fill={c.ink} />
        ) : (
          <Path
            d={entry.d}
            fill="none"
            stroke={c.ink}
            strokeWidth={glyphStrokeWidth(entry, style)}
            strokeLinejoin="round"
          />
        )}
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
  onPickImage,
  onPickIcon,
}: InsertSheetProps) {
  const { colors: c } = useTheme();
  const { t, language } = useT();
  const { height } = useWindowDimensions();
  const [tab, setTab] = useState<InsertTab>('glyphs');
  /**
   * Icon search state. The catalogue is ~300k icons across 200+ sets and is
   * queried over the network, so it is debounced and every write happens inside
   * the timer's async callback rather than synchronously in the effect body —
   * the same discipline the font picker's Google section follows.
   */
  const [iconQuery, setIconQuery] = useState('');
  const [iconState, setIconState] = useState<IconSearchState>('idle');
  const [iconHits, setIconHits] = useState<IconSearchHit[]>([]);
  const [iconBusyKey, setIconBusyKey] = useState<string | null>(null);
  // The ornament paint style the next placed ornament gets; also drives the
  // tile previews, so a tile always shows exactly what it will insert.
  const [glyphStyle, setGlyphStyle] = useState<GlyphStyle>(GLYPH_DEFAULT_STYLE);
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

  // Debounced catalogue search. All state writes live in the timer callback, so
  // a keystroke never cascades a render synchronously from the effect body.
  useEffect(() => {
    const q = iconQuery.trim();
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        if (!q) {
          setIconState('idle');
          setIconHits([]);
          return;
        }
        setIconState('loading');
        try {
          const hits = await searchIcons(q);
          if (!cancelled) {
            setIconHits(hits);
            setIconState('ready');
          }
        } catch {
          if (!cancelled) {
            setIconHits([]);
            setIconState('error');
          }
        }
      },
      q ? ICON_SEARCH_DEBOUNCE_MS : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [iconQuery]);

  /**
   * Resolve a hit and hand it over. The sheet is deliberately **not** closed
   * first here: fetching is a network round-trip with a visible wait, and closing
   * the sheet would hide the spinner that explains it.
   */
  const importIcon = (hit: IconSearchHit) => {
    setIconBusyKey(hit.key);
    onPickIcon(hit);
    // The sheet stays mounted while the fetch is in flight; the parent clears
    // the busy row by remounting on the next open, so no completion signal is
    // needed here.
    setIconBusyKey(null);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t.editor.glyphs}
      closeButton
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
          <Button
            label={t.editor.media}
            variant={tab === 'media' ? 'primary' : 'secondary'}
            selected={tab === 'media'}
            onPress={() => setTab('media')}
            style={styles.tab}
          />
        </View>

        {tab === 'glyphs' ? (
          <>
            <View style={styles.tabs}>
              {(
                [
                  ['solid', t.editor.glyphSolid],
                  ['outline', t.editor.glyphOutline],
                  ['thin', t.editor.glyphThin],
                ] as const
              ).map(([style, label]) => (
                <Button
                  key={style}
                  label={label}
                  variant={glyphStyle === style ? 'primary' : 'secondary'}
                  selected={glyphStyle === style}
                  onPress={() => setGlyphStyle(style)}
                  style={styles.tab}
                />
              ))}
            </View>
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
                        style={glyphStyle}
                        label={
                          language === 'ar' ? entry.labelAr : entry.labelEn
                        }
                        onPress={pick(() => onPickGlyph(entry.key, glyphStyle))}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </>
        ) : tab === 'shapes' ? (
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
        ) : (
          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                { color: c.muted, fontFamily: fonts.ui },
              ]}
            >
              {t.editor.insertImageFromGallery}
            </Text>
            {/* One button, not a grid: the source is the photo library, so there
                is nothing inside the app to browse. */}
            <Button
              label={t.editor.insertImageFromGallery}
              onPress={pick(onPickImage)}
              fullWidth
              variant="secondary"
            />

            {/* Imported icons. The catalogue is searched by name; a hit that
                cannot be inked (a palette set) or cannot be stored as paths is
                shown disabled with the reason rather than hidden, so the search
                looks like what it is instead of quietly missing results. */}
            <View style={styles.iconSection}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: c.muted, fontFamily: fonts.ui },
                ]}
              >
                {t.editor.icons}
              </Text>
              <View
                style={[
                  styles.search,
                  { backgroundColor: c.surfaceAlt, borderColor: c.border },
                ]}
              >
                <TextInput
                  value={iconQuery}
                  onChangeText={setIconQuery}
                  placeholder={t.editor.searchIcons}
                  placeholderTextColor={c.muted}
                  accessibilityLabel={t.editor.searchIcons}
                  style={[
                    styles.searchInput,
                    { color: c.ink, fontFamily: fonts.ui },
                  ]}
                />
              </View>

              {iconState === 'loading' && (
                <ActivityIndicator
                  color={c.muted}
                  style={styles.iconStatus}
                  accessibilityLabel={t.common.loading}
                />
              )}
              {iconState === 'error' && (
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: c.danger, fontFamily: fonts.ui },
                  ]}
                >
                  {t.editor.iconSearchFailed}
                </Text>
              )}

              <ScrollView
                style={{ maxHeight: Math.round(height * GRID_MAX_FRACTION) }}
                contentContainerStyle={styles.iconList}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
              >
                {iconHits.map((hit) => {
                  const blocked = !hit.allowed
                    ? t.editor.iconShapeUnsupported
                    : hit.palette
                      ? t.editor.iconPaletteUnsupported
                      : null;
                  const busy = iconBusyKey === hit.key;
                  return (
                    <AnimatedPressable
                      key={hit.key}
                      accessibilityRole="button"
                      accessibilityState={{
                        disabled: blocked !== null || busy,
                        busy,
                      }}
                      accessibilityLabel={
                        blocked ? `${hit.name}, ${blocked}` : hit.name
                      }
                      disabled={blocked !== null || busy}
                      onPress={() => importIcon(hit)}
                      style={[
                        styles.iconRow,
                        {
                          borderColor: c.border,
                          backgroundColor: c.surface,
                          opacity: blocked ? 0.45 : 1,
                        },
                      ]}
                    >
                      <View style={styles.iconRowMain}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.iconName,
                            { color: c.ink, fontFamily: fonts.ui },
                          ]}
                        >
                          {hit.name}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.sectionTitle,
                            {
                              color: blocked ? c.danger : c.muted,
                              fontFamily: fonts.ui,
                            },
                          ]}
                        >
                          {blocked ?? hit.setName}
                        </Text>
                      </View>
                      {busy && (
                        <ActivityIndicator
                          size="small"
                          color={c.muted}
                          accessibilityLabel={t.common.loading}
                        />
                      )}
                    </AnimatedPressable>
                  );
                })}
              </ScrollView>
            </View>
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
  /** The icon block: search field, status, then the results list. */
  iconSection: { gap: spacing.sm, paddingTop: spacing.md },
  iconList: { gap: spacing.xs },
  iconStatus: { paddingVertical: spacing.md, alignSelf: 'center' },
  iconRow: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconRowMain: { flex: 1, gap: 2 },
  iconName: { fontSize: typeScale.body.size },
  search: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInput: { fontSize: typeScale.body.size, padding: 0 },
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
