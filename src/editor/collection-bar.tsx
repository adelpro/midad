import { useCallback, useState } from 'react';
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
  type CollectionFrame,
} from '@/editor/groups';
import { useEditorStore } from '@/editor/store';
import { usePressFeedback } from '@/hooks/use-press-feedback';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { rowStyle } from '@/i18n/rtl';
import {
  formatMemberLabel,
  formatPartLabel,
  type Language,
} from '@/i18n/strings';
import type { DesignObject } from '@/storage/project-schema';
import {
  elevationStyle,
  fontRoles,
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
 * The head and the step arrows are a full 40dp target, which is what fixes the
 * bar's height at 44 with its own padding. Deliberately the same size as a rail
 * button: the two rows are different surfaces, not different scales.
 */
const BAR_CONTROL_SIZE = 40;
/** Side of the head's leading glyph. */
const HEAD_ICON_SIZE = 13;
/** Side of the step arrows' glyph. */
const STEP_ICON_SIZE = 16;
/** Side of a member tile's glyph, and the tile's own metrics. */
const TILE_GLYPH_SIZE = 18;
const TILE_HEIGHT = 38;
const TILE_MIN_WIDTH = 40;

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
export function CollectionBar({
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
  const top = frameTopCentre(frame);
  const bottom = frameBottomCentre(frame);
  const placement = collectionBarPlacement({
    topAnchor: { x: top.x * scale + offsetX, y: top.y * scale + offsetY },
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
                  label={memberLabel(member, index, members.length, language)}
                  member={member}
                  index={index}
                  active={index === activeIndex}
                  onPress={() => onEnterMember(member.id)}
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
 */
function MemberTile({
  label,
  member,
  index,
  active,
  onPress,
}: {
  label: string;
  member: DesignObject;
  index: number;
  active: boolean;
  onPress: () => void;
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
      onPress={onPress}
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
      {member.type === 'text' ? (
        // The member's own font, so the tile shows the glyph exactly as the
        // canvas does.
        <Text
          numberOfLines={1}
          style={[
            styles.tileGlyph,
            { color: c.ink, fontFamily: member.fontKey },
          ]}
        >
          {member.text}
        </Text>
      ) : (
        <Icon
          name={member.type === 'shape' ? 'shapes' : 'sparkle'}
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
}

const styles = StyleSheet.create({
  /**
   * The bar's layer, inset by the canvas wrapper's own padding so its box is the
   * **canvas card's** box — the same reasoning `LearnOverlay` documents.
   *
   * The chip that preceded this component sat on a full-bleed layer instead, and
   * clamped its own position against the card's width from a box that was a
   * whole padding-step larger. Its `left: 4` was therefore 8dp *outside* the card
   * it was labelling. An absolutely positioned fill spans the wrapper's border
   * box, so the inset has to be explicit.
   */
  layer: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
  },
  bar: {
    position: 'absolute',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xxs,
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
   */
  trackScroll: { flexShrink: 1, minWidth: 0 },
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
