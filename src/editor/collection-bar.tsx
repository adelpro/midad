import { memo, useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useAnimatedStyle } from 'react-native-reanimated';

import {
  AnimatedPressable,
  DirectionIcon,
  Icon,
  IconButton,
} from '@/components/ui';
import {
  collectionBarPlacement,
  frameBottomCentre,
  frameTopCentre,
  selectionCollection,
  selectionFrame,
  type CollectionFrame,
} from '@/editor/groups';
import {
  ROTATE_GRIP_RADIUS,
  ROTATE_HANDLE_GAP,
  SELECTION_HANDLE_PAD,
} from '@/editor/hit-test';
import { useEditorStore } from '@/editor/store';
import { usePressFeedback } from '@/hooks/use-press-feedback';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { rowStyle } from '@/i18n/rtl';
import {
  formatCollectionGroup,
  formatMemberLabel,
  formatPartLabel,
  formatSelectedCount,
  type Language,
} from '@/i18n/strings';
import type { DesignObject } from '@/storage/project-schema';
import {
  elevationStyle,
  fontRoles,
  layout,
  radius,
  shadows,
  spacing,
  typeScale,
  withAlpha,
} from '@/theme';

/** Clearance (view px) between the bar and the frame edge it sits beside. */
const BAR_GAP = 8;
/** Inset (view px) the bar keeps from the canvas card's edges. */
const BAR_MARGIN = 4;
/**
 * The head and the step arrows are a full 40dp target, deliberately the same
 * size as a rail button: the two rows are different surfaces, not different
 * scales. The member tiles are a full 44dp target in their own right (see
 * `TILE_HEIGHT`), which is what sets the bar's height at 52 with its 4dp
 * padding.
 */
const BAR_CONTROL_SIZE = 40;
/** Side of the head's leading glyph. */
const HEAD_ICON_SIZE = 13;
/** Side of the step arrows' glyph. */
const STEP_ICON_SIZE = 16;
/** Side of a member tile's glyph, and the tile's own metrics. */
const TILE_GLYPH_SIZE = 18;
/**
 * The tile is a full 44pt target in both directions — DESIGN.md's touch floor,
 * not a decoration enlarged by `hitSlop`. `hitSlop` cannot escape its parent
 * (`trackScroll` is exactly the tile's height), so a slop on a 38pt tile would
 * still clamp to 38; sizing the tile itself is the only honest way to meet it.
 */
const TILE_HEIGHT = 44;
const TILE_MIN_WIDTH = 44;

/**
 * The bar's fill is the surface at this alpha. DESIGN.md §5 puts a chrome bar
 * over content *semi-transparent* for a reason: an opaque bar over the canvas is
 * `surface` on a `surface`-coloured canvas card, which is what the chip this
 * replaces was — legible only by its hairline.
 */
const BAR_SURFACE_ALPHA = 0.92;

/**
 * A member's label: a split word's members are letters and use the *part*
 * vocabulary, everything else uses the *member* one.
 *
 * One rule, exported because the screen needs it too — the head's accessibility
 * label while a collection is entered names the same member this tile does, so
 * the two cannot describe one member differently.
 */
export function memberLabel(
  member: DesignObject,
  index: number,
  total: number,
  language: Language,
): string {
  return member.type === 'text' && member.part !== undefined
    ? formatPartLabel(index, total, language)
    : formatMemberLabel(index, total, language);
}

export interface CollectionBarProps {
  /** The box the bar is anchored to, in design units. */
  frame: CollectionFrame;
  /**
   * What the head says, already resolved: the element count for a whole
   * selection, the member's position while a collection is entered.
   */
  text: string;
  accessibilityLabel: string;
  accessibilityHint: string;
  /**
   * The way back to the whole collection, offered only while one is entered.
   * Absent leaves the head a plain label — there is nothing to go back to.
   */
  onPress?: () => void;
  /** Which glyph leads the head. */
  mode: 'whole' | 'entered';
  /**
   * The members the track navigates, in reading order. Two or more render it;
   * a loose multi-selection has none, so the bar is a bare head.
   */
  members: readonly DesignObject[];
  /** Which member is the primary selection, or `-1` while whole. */
  activeIndex: number;
  /** Enter a member. Learn-mode bound by the screen, like every other press. */
  onEnterMember: (id: string) => void;
  /** Step to the neighbouring member, with wraparound. */
  onStep: (direction: 1 | -1) => void;
}

/**
 * The collection bar's host: the bar, plus the one thing that needs the canvas's
 * *measured* geometry — where the frame is.
 *
 * **Why the host exists.** `sizedObjects` is published by `EditorCanvas` in an
 * effect, after the render that produced it, so every frame of a drag writes the
 * store twice. Reading that field from `EditorScreen` re-rendered the entire
 * screen a second time per frame — top bar, both rails, four sheets — to move one
 * label. Subscribed to here, the same write re-renders this subtree alone. Do not
 * lift `sizedObjects` back up into the screen.
 *
 * The head's copy and its way back out arrive already resolved (`role`,
 * `onExitCollection`) because binding a press belongs to the screen — learn mode
 * intercepts it — and none of it depends on geometry. Only the frame does, and
 * `selectionFrame` is the same derivation the canvas draws and the gesture layer
 * grabs, so the bar can never end up pointing at a box of its own.
 */
export function CollectionBarHost({
  selectedIds,
  members,
  activeIndex,
  role,
  onExitCollection,
  onEnterMember,
  onStep,
}: {
  selectedIds: readonly string[];
  members: readonly DesignObject[];
  activeIndex: number;
  /** The bar's role sentence, for the head's accessibility hint. */
  role: string;
  /** The way back out of an entered collection, already help-mode bound. */
  onExitCollection?: () => void;
  onEnterMember: (id: string) => void;
  onStep: (direction: 1 | -1) => void;
}) {
  const { language } = useT();
  const sizedObjects = useEditorStore((s) => s.sizedObjects);
  const project = useEditorStore((s) => s.project);

  const head = useMemo(() => {
    const selection = selectionFrame(selectedIds, sizedObjects);
    if (!selection) {
      return null;
    }
    if (selection.state === 'entered') {
      const index = selection.members.findIndex((m) => m.id === selectedIds[0]);
      const total = selection.members.length;
      // The member's own label, not the primary text's: the rule has to hold for
      // every member of the collection, which is exactly what `collectionMembers`
      // uses to decide reading order.
      const primary = members[index];
      return {
        frame: selection.frame,
        mode: 'entered' as const,
        // Position only: the bar's track names the member, and the head is a
        // label rather than a sentence.
        text: `${index + 1}/${total}`,
        label: primary
          ? memberLabel(primary, index, total, language)
          : `${index + 1}/${total}`,
        hint: role,
        onPress: onExitCollection,
      };
    }
    const text =
      selectionCollection(selectedIds, project?.objects ?? []) !== null
        ? formatCollectionGroup(selection.members.length, language)
        : formatSelectedCount(selection.members.length, language);
    return {
      frame: selection.frame,
      mode: 'whole' as const,
      text,
      label: text,
      hint: role,
      // Nothing to go back to: a whole selection already is the whole thing.
      onPress: undefined,
    };
  }, [
    selectedIds,
    sizedObjects,
    project,
    members,
    language,
    role,
    onExitCollection,
  ]);

  if (!head) {
    return null;
  }
  return (
    <CollectionBar
      frame={head.frame}
      mode={head.mode}
      text={head.text}
      accessibilityLabel={head.label}
      accessibilityHint={head.hint}
      onPress={head.onPress}
      members={members}
      activeIndex={activeIndex}
      onEnterMember={onEnterMember}
      onStep={onStep}
    />
  );
}

/**
 * The collection bar: what the selection *is*, and how to walk it.
 *
 * It carries the two things a collection needs — the head that names it (or
 * says which member you are on, and takes you back out) and the track of member
 * tiles with prev/next stepping — and it lives on the canvas, anchored to the
 * frame, rather than in the selection rail.
 *
 * **Why it left the rail.** The rail is 56dp tall and holds the selection's
 * *actions*. The track is not an action: it is navigation, and it was competing
 * for the same width. With a three-part word selected, the two step arrows alone
 * spent 84 of the ~146dp the context zone was allowed, so the rail truncated to
 * three actions and the tiles scrolled one-and-a-half deep — a word could not be
 * walked, and the actions could not be reached. On the canvas the bar has the
 * whole card's width, and the rail keeps its budget for actions.
 *
 * It is a **sibling of the gesture detector**, exactly as the chip was, so it
 * cannot resize the canvas (which would re-run the fit-to-view and visibly zoom
 * the design) and its presses and scrolls never race the canvas pan. Its layer
 * is `box-none`, so the canvas keeps every touch that is not on the bar itself.
 */
function CollectionBar({
  frame,
  text,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  mode,
  members,
  activeIndex,
  onEnterMember,
  onStep,
}: CollectionBarProps) {
  const { t, language, isRTL } = useT();
  const { colors: c } = useTheme();
  const fonts = fontRoles[language];
  const { scale, offsetX, offsetY, w, h } = useEditorStore((s) => s.viewport);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);

  // The frame's two edge midpoints, in view px, so the bar tracks pan and zoom
  // with the box rather than with where the selection happened to be on mount.
  //
  // A *whole* collection draws its rotate grip centred on the frame's top edge,
  // 30pt above it (`ROTATE_HANDLE_GAP`) plus the 6pt handle pad and the grip's
  // own 7pt radius. The bar's preferred side is that same top edge, so it used to
  // be painted straight over the grip — the one handle with no other route. The
  // top anchor is therefore lifted past the whole grip, along the frame's own up
  // direction so a rotated frame keeps it clear too. An *entered* collection draws
  // no handles on its frame, so there is nothing to clear.
  const clearance =
    mode === 'whole'
      ? SELECTION_HANDLE_PAD + ROTATE_HANDLE_GAP + ROTATE_GRIP_RADIUS
      : 0;
  const rad = (frame.rotation * Math.PI) / 180;
  const top = frameTopCentre(frame);
  const bottom = frameBottomCentre(frame);
  const placement = collectionBarPlacement({
    topAnchor: {
      x: top.x * scale + offsetX + Math.sin(rad) * clearance,
      y: top.y * scale + offsetY - Math.cos(rad) * clearance,
    },
    bottomAnchor: {
      x: bottom.x * scale + offsetX,
      y: bottom.y * scale + offsetY,
    },
    barWidth: size.width,
    barHeight: size.height,
    viewW: w,
    viewH: h,
    margin: BAR_MARGIN,
    gap: BAR_GAP,
  });

  // A lone member is not a track — and a loose multi-selection has no members
  // at all (`collectionMembers` returns none), which is what keeps the bar a
  // bare head for `Selected: 3`.
  const showTrack = members.length > 1;

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <View
        onLayout={onLayout}
        style={[
          styles.bar,
          rowStyle(isRTL),
          {
            left: placement.left,
            top: placement.top,
            maxWidth: Math.max(0, w - 2 * BAR_MARGIN),
            backgroundColor: withAlpha(c.surface, BAR_SURFACE_ALPHA),
            borderColor: c.border,
          },
          elevationStyle(c, shadows.card),
        ]}
      >
        <Pressable
          onPress={onPress}
          disabled={!onPress}
          accessibilityRole={onPress ? 'button' : 'text'}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          style={[styles.head, rowStyle(isRTL)]}
        >
          <Icon
            name={
              mode === 'entered'
                ? isRTL
                  ? 'chevronRight'
                  : 'chevronLeft'
                : 'group'
            }
            size={HEAD_ICON_SIZE}
            color={c.muted}
          />
          <Text
            style={[styles.headText, { color: c.ink, fontFamily: fonts.ui }]}
          >
            {text}
          </Text>
        </Pressable>

        {showTrack && (
          <>
            {/*
             * The separator is what keeps the two halves legible as two halves.
             * Without it the head's `2/3` and the tiles read as one run of
             * chips, which is the confusion that put the track here in the
             * first place.
             */}
            <View style={[styles.divider, { backgroundColor: c.border }]} />

            <IconButton
              onPress={() => onStep(-1)}
              accessibilityLabel={t.editor.hints.partPrev}
              hint={t.editor.hints.partPrev}
            >
              <DirectionIcon isRTL={!isRTL} size={STEP_ICON_SIZE} />
            </IconButton>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.trackScroll}
              contentContainerStyle={[styles.track, rowStyle(isRTL)]}
            >
              {members.map((member, index) => (
                <MemberTile
                  key={member.id}
                  memberId={member.id}
                  kind={member.type}
                  text={member.type === 'text' ? member.text : ''}
                  fontKey={member.type === 'text' ? member.fontKey : ''}
                  label={memberLabel(member, index, members.length, language)}
                  index={index}
                  active={index === activeIndex}
                  onEnter={onEnterMember}
                />
              ))}
            </ScrollView>

            <IconButton
              onPress={() => onStep(1)}
              accessibilityLabel={t.editor.hints.partNext}
              hint={t.editor.hints.partNext}
            >
              <DirectionIcon isRTL={isRTL} size={STEP_ICON_SIZE} />
            </IconButton>
          </>
        )}
      </View>
    </View>
  );
}

/**
 * One member tile in the track.
 *
 * A text member shows its own glyph in its own font — a faithful preview, which
 * is what makes a split word navigable letter by letter. Anything else shows its
 * kind's glyph instead, because a 40dp tile cannot show an ornament honestly —
 * and for those the index caption is the only thing telling two tiles apart,
 * which is why it is not decoration.
 *
 * Split out of the bar because it owns press feedback — hooks cannot be called
 * from inside the bar's `map`.
 *
 * Memoized on primitives. The bar repositions on every drag frame (the box it
 * labels moves with the selection), and without this every tile re-rendered each
 * of those frames although none of its content had changed. The member is passed
 * as the few fields the tile draws — not the object — so a transform-only frame
 * cannot break the memo by handing it a new object reference.
 */
const MemberTile = memo(function MemberTile({
  memberId,
  kind,
  text,
  fontKey,
  label,
  index,
  active,
  onEnter,
}: {
  memberId: string;
  kind: DesignObject['type'];
  text: string;
  fontKey: string;
  label: string;
  index: number;
  active: boolean;
  onEnter: (id: string) => void;
}) {
  const { colors: c } = useTheme();
  const { language } = useT();
  const fonts = fontRoles[language];
  const press = usePressFeedback();
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={() => onEnter(memberId)}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[
        styles.tile,
        {
          borderColor: active ? c.accent : c.border,
          // A recessed paper chip on the bar's frosted surface: the tone does
          // the separating, so an inactive tile needs no border weight.
          backgroundColor: active ? c.accentSoft : c.paper,
        },
        animStyle,
      ]}
    >
      {kind === 'text' ? (
        // The member's own font, so the tile shows the glyph exactly as the
        // canvas does.
        <Text
          numberOfLines={1}
          style={[styles.tileGlyph, { color: c.ink, fontFamily: fontKey }]}
        >
          {text}
        </Text>
      ) : (
        <Icon
          name={kind === 'shape' ? 'shapes' : 'sparkle'}
          size={TILE_GLYPH_SIZE}
          color={c.ink}
        />
      )}
      <Text
        style={[styles.tileIndex, { color: c.muted, fontFamily: fonts.ui }]}
      >
        {index + 1}
      </Text>
    </AnimatedPressable>
  );
});

const styles = StyleSheet.create({
  /**
   * The bar's layer: exactly the canvas **drawing box** — the wrapper's padding
   * plus the card's border, which is the box `EditorCanvas` measures and draws
   * into, and the box the published `Viewport` maps design space into.
   *
   * The chip that preceded this component sat on a full-bleed layer instead, and
   * clamped its own position against the card's width from a box that was a
   * whole padding-step larger. Its `left: 4` was therefore 8dp *outside* the card
   * it was labelling. An absolutely positioned fill spans the wrapper's border
   * box, so the inset has to be explicit.
   *
   * Aligning to the card's *outer* box instead (padding only) is what left the bar
   * a border-width off centre: the anchor is relative to the drawing box, so the
   * layer has to be the drawing box for the two spaces to coincide.
   */
  layer: {
    position: 'absolute',
    // The canvas drawing box, not the card's outer box: `EditorCanvas` measures
    // and draws into the box *inside* the card's border, and the bar's anchor
    // coordinates are relative to that box (the published `Viewport` maps design
    // space into it). Insetting only by the wrapper's padding would leave the
    // layer one border-width outside the drawing box, so the bar would sit a
    // border-width off centre on every selection. Adding the card's border makes
    // the layer's origin and width exactly the drawing box, so the placement
    // maths and its canvas-edge clamp run in the same space the anchor does.
    top: spacing.md + layout.canvasBorder,
    left: spacing.md + layout.canvasBorder,
    right: spacing.md + layout.canvasBorder,
    bottom: spacing.md + layout.canvasBorder,
  },
  bar: {
    position: 'absolute',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  head: {
    alignItems: 'center',
    gap: spacing.xs,
    height: BAR_CONTROL_SIZE,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  headText: {
    fontSize: typeScale.micro.size,
    lineHeight: typeScale.micro.lineHeight,
  },
  divider: { width: StyleSheet.hairlineWidth, height: 24 },
  /**
   * `minWidth: 0` is what lets the track shrink below its content on web, where
   * a flex item's automatic minimum size is its content — without it a long word
   * would push the next arrow out of the bar instead of scrolling.
   *
   * `flexGrow: 0` is the other half: React Native's ScrollView carries
   * `flexGrow: 1` in its own base style, so an absolutely-positioned bar left the
   * track to swallow every spare pixel — the bar stretched to the full card and
   * the tiles sat in the middle of a wide empty strip. The bar must size to its
   * content and only shrink (scroll) once the tiles genuinely outgrow the card.
   */
  trackScroll: { flexGrow: 0, flexShrink: 1, minWidth: 0 },
  track: { alignItems: 'center', gap: spacing.xs },
  tile: {
    minWidth: TILE_MIN_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: radius.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    gap: spacing.xxs,
  },
  tileGlyph: { fontSize: TILE_GLYPH_SIZE, lineHeight: 22 },
  tileIndex: {
    fontSize: typeScale.micro.size,
    lineHeight: typeScale.micro.lineHeight,
  },
});
