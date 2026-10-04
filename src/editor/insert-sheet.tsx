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

import {
  AnimatedPressable,
  Button,
  Icon,
  Reveal,
  Sheet,
} from '@/components/ui';
import {
  GLYPH_DEFAULT_STYLE,
  glyphStrokeWidth,
  glyphViewBox,
  glyphsInGroup,
  type GlyphCatalogEntry,
  type GlyphGroup,
  type GlyphStyle,
} from '@/editor/glyphs';
import type { IconPath } from '@/editor/icons/icon-geometry';
import { DEFAULT_ICONS, type StoredIcon } from '@/editor/icons/icon-library';
import {
  SHAPE_BASE_SIZE,
  SHAPE_INSET,
  SHAPE_PATH_BUILDERS,
} from '@/editor/skia/shape-geometry';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import {
  fetchIcon,
  fetchIconPreviews,
  searchIcons,
  type IconPreview,
  type IconSearchHit,
} from '@/storage/icon-search';
import { useSettings } from '@/storage/settings';
import { useRowWaitMotion } from '@/editor/use-row-wait-motion';
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
  /** Opens the photo library to place an image on the canvas. Rejects if the write fails. */
  onPickImage: () => Promise<void>;
  /** Places an icon whose geometry is already resolved — from a search, a recent or the defaults. */
  onInsertIcon: (icon: StoredIcon) => void;
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
  onInsertIcon,
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
  /** Geometry for the visible hits, keyed by `prefix:name`. */
  const [iconPreviews, setIconPreviews] = useState<Map<string, IconPreview>>(
    new Map(),
  );
  const [iconBusyKey, setIconBusyKey] = useState<string | null>(null);
  /** A hit whose import failed — its row turns into a retry affordance. */
  const [iconFailedKey, setIconFailedKey] = useState<string | null>(null);
  /**
   * The recents list and its mutators come from the settings store rather than
   * local state: it is persisted (the empty state must survive a restart) and it
   * is shared with anything else that inserts an icon.
   */
  const recentIcons = useSettings((state) => state.recentIcons);
  const rememberIcon = useSettings((state) => state.rememberIcon);
  const forgetIcon = useSettings((state) => state.forgetIcon);
  const clearRecentIcons = useSettings((state) => state.clearRecentIcons);
  /**
   * Whether the field holds a query. When it does, live search results replace
   * the empty state; when it does not, the recents (or the defaults) are shown, so
   * the block is never blank.
   */
  const searching = iconQuery.trim().length > 0;
  /** What the empty state lists: this device's recents, or the shipped defaults. */
  const emptyState: readonly StoredIcon[] =
    recentIcons.length > 0 ? recentIcons : DEFAULT_ICONS;
  /** A photo pick whose store write failed — the sheet says so. */
  const [imageFailed, setImageFailed] = useState(false);
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
          if (cancelled) {
            return;
          }
          setIconHits(hits);
          setIconState('ready');
          // Previews resolve after the list is on screen: the names are what the
          // search returns, and the geometry is a second, batched request. The
          // rows render (and are tappable) in between, so a slow preview never
          // delays the search.
          const previews = await fetchIconPreviews(hits);
          if (!cancelled) {
            setIconPreviews(previews);
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
   * Place a photo. Closes only once the bytes have actually been written — the
   * pick can succeed and the store write still fail (a full disk, a permissions
   * error), and closing first would leave the user staring at a canvas with no
   * photo and no explanation.
   */
  const importImage = async () => {
    setImageFailed(false);
    try {
      await onPickImage();
      onClose();
    } catch {
      setImageFailed(true);
    }
  };

  /**
   * Resolve a search hit and place it.
   *
   * The fetch lives here rather than in the caller because it is what produces
   * the geometry the canvas needs *and* the entry the recents list keeps. The
   * sheet is deliberately **not** closed first: fetching is a network round-trip
   * with a visible wait, and closing would hide the spinner that explains it.
   * A failed fetch is a row-level outcome (offline, every host down) that needs a
   * retry affordance rather than an unhandled rejection; a refused icon
   * (`fetchIcon` returns `null`) cannot normally be reached, because its row is
   * disabled, but it is handled the same way.
   */
  const importIcon = async (hit: IconSearchHit) => {
    setIconBusyKey(hit.key);
    setIconFailedKey(null);
    try {
      const fetched = await fetchIcon(hit);
      if (!fetched) {
        setIconFailedKey(hit.key);
        return;
      }
      const icon: StoredIcon = {
        key: hit.key,
        name: hit.name,
        setName: hit.setName,
        viewBox: fetched.viewBox,
        paths: fetched.paths,
      };
      onInsertIcon(icon);
      rememberIcon(icon);
    } catch {
      setIconFailedKey(hit.key);
    } finally {
      setIconBusyKey(null);
    }
  };

  /** Place an icon whose geometry is already resolved, then remember it. */
  const insertResolved = (icon: StoredIcon) => {
    onInsertIcon(icon);
    rememberIcon(icon);
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
          <Reveal style={styles.grid}>
            {SHAPE_KEYS.map((key) => (
              <ShapeTile
                key={key}
                shapeKey={key}
                label={shapeLabels[key]}
                onPress={pick(() => onPickShape(key))}
              />
            ))}
          </Reveal>
        ) : (
          <Reveal style={styles.section}>
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
              onPress={importImage}
              fullWidth
              variant="secondary"
            />
            {imageFailed && (
              <Text
                style={[
                  styles.sectionTitle,
                  { color: c.danger, fontFamily: fonts.ui },
                ]}
              >
                {t.editor.imageInsertFailed}
              </Text>
            )}

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

              {!searching && (
                <View style={styles.iconListHeader}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: c.muted, fontFamily: fonts.uiBold },
                    ]}
                  >
                    {recentIcons.length > 0
                      ? t.editor.recentIcons
                      : t.editor.suggestedIcons}
                  </Text>
                  {recentIcons.length > 0 && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t.editor.iconClearRecents}
                      onPress={clearRecentIcons}
                      hitSlop={8}
                    >
                      <Text
                        style={[
                          styles.sectionTitle,
                          { color: c.muted, fontFamily: fonts.ui },
                        ]}
                      >
                        {t.editor.iconClearRecents}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}

              <ScrollView
                style={{ maxHeight: Math.round(height * GRID_MAX_FRACTION) }}
                contentContainerStyle={styles.iconList}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
              >
                {searching
                  ? iconHits.map((hit) => {
                      const preview = iconPreviews.get(hit.key);
                      // Read from the resolved geometry where there is one, not
                      // only the set's `palette` flag: a set can be monotone
                      // overall while one icon paints its own colours. A row
                      // whose preview has not arrived is not blocked — it is
                      // merely un-previewed, and the tap resolves it for real.
                      const blocked = !hit.allowed
                        ? t.editor.iconShapeUnsupported
                        : hit.palette || preview?.paths === null
                          ? t.editor.iconPaletteUnsupported
                          : null;
                      const failed = iconFailedKey === hit.key;
                      return (
                        <IconRow
                          key={hit.key}
                          name={hit.name}
                          detail={
                            blocked ??
                            (failed ? t.editor.iconSearchFailed : hit.setName)
                          }
                          blocked={blocked}
                          paths={preview?.paths ?? null}
                          viewBox={preview?.viewBox}
                          busy={iconBusyKey === hit.key}
                          failed={failed}
                          onPress={() => void importIcon(hit)}
                        />
                      );
                    })
                  : emptyState.map((icon) => (
                      <IconRow
                        key={icon.key}
                        name={icon.name}
                        detail={icon.setName}
                        blocked={null}
                        paths={icon.paths}
                        viewBox={icon.viewBox}
                        busy={false}
                        failed={false}
                        onPress={() => insertResolved(icon)}
                        onForget={
                          recentIcons.length > 0
                            ? () => forgetIcon(icon.key)
                            : undefined
                        }
                        forgetLabel={t.editor.iconForget}
                      />
                    ))}
              </ScrollView>
            </View>
          </Reveal>
        )}
      </View>
    </Sheet>
  );
}

/**
 * One icon row — a search hit, a recent, or a default.
 *
 * Its own component rather than an inline `map` body for two reasons: the wait
 * motion is a hook, and a hook cannot live inside a callback; and the row's
 * blocked/busy/failed/forgettable states read better named than nested.
 *
 * The disabled look is applied as a **static** opacity from the style array while
 * the wait motion drives an animated one — deliberately not both at once. A row
 * that is blocked was never tapped, so it has no wait to express, and the two
 * would multiply into a double-faded row.
 *
 * `onForget` is passed only for a recent: the × forgets it. A default has no
 * origin to forget, and a search hit is not remembered until it is inserted.
 */
function IconRow({
  name,
  detail,
  blocked,
  paths,
  viewBox,
  busy,
  failed,
  onPress,
  onForget,
  forgetLabel,
}: {
  name: string;
  detail: string;
  /** Why the row cannot be imported, or `null` when it can. */
  blocked: string | null;
  /** Resolved geometry, or `null` before a preview has arrived. */
  paths: IconPath[] | null;
  viewBox: { width: number; height: number } | undefined;
  busy: boolean;
  failed: boolean;
  onPress: () => void;
  onForget?: () => void;
  forgetLabel?: string;
}) {
  const { colors: c } = useTheme();
  const { t, language } = useT();
  const fonts = fontRoles[language];
  const waitStyle = useRowWaitMotion(busy);

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked !== null || busy, busy }}
      accessibilityLabel={
        blocked ? `${name}, ${blocked}` : failed ? `${name}, ${detail}` : name
      }
      disabled={blocked !== null || busy}
      onPress={onPress}
      style={[
        styles.iconRow,
        {
          borderColor: failed ? c.danger : c.border,
          backgroundColor: c.surface,
        },
        blocked !== null && { opacity: 0.45 },
        waitStyle,
      ]}
    >
      <View style={[styles.iconPreview, { borderColor: c.border }]}>
        {paths && viewBox ? (
          <Svg width={PREVIEW} height={PREVIEW} viewBox={viewBoxFor(viewBox)}>
            {paths.map((entry, index) => (
              <Path
                key={index}
                d={entry.d}
                fill={c.ink}
                fillRule={entry.fillRule === 'evenodd' ? 'evenodd' : 'nonzero'}
              />
            ))}
          </Svg>
        ) : busy ? (
          <ActivityIndicator size="small" color={c.muted} />
        ) : null}
      </View>

      <View style={styles.iconRowMain}>
        <Text
          numberOfLines={1}
          style={[styles.iconName, { color: c.ink, fontFamily: fonts.ui }]}
        >
          {name}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.sectionTitle,
            {
              color: blocked || failed ? c.danger : c.muted,
              fontFamily: fonts.ui,
            },
          ]}
        >
          {detail}
        </Text>
      </View>
      {busy && (
        <ActivityIndicator
          size="small"
          color={c.muted}
          accessibilityLabel={t.common.loading}
        />
      )}
      {onForget && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={forgetLabel ? `${name}, ${forgetLabel}` : name}
          onPress={onForget}
          hitSlop={10}
          style={styles.iconForget}
        >
          <Icon name="close" size={18} color={c.muted} />
        </Pressable>
      )}
    </AnimatedPressable>
  );
}

/** A `viewBox` string for one preview, from the icon set's own box. */
function viewBoxFor(viewBox: { width: number; height: number }): string {
  return `0 0 ${viewBox.width} ${viewBox.height}`;
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
  /** The empty state's caption row: what the list is, and how to clear it. */
  iconListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
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
  /**
   * The preview tile. A fixed box whether or not geometry has arrived, so the
   * list never reflows as previews stream in — a list that shifts under the
   * finger is how the wrong row gets tapped.
   */
  iconPreview: {
    width: PREVIEW,
    height: PREVIEW,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRowMain: { flex: 1, gap: 2 },
  /** The × that forgets a recent — padded into its own touch target. */
  iconForget: {
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
