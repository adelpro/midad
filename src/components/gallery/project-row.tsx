import { useCallback, useEffect } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Card, DirectionIcon, Icon, IconButton } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { useT } from "@/i18n";
import { rowStyle } from "@/i18n/rtl";
import { usePins } from "@/storage/pins";
import type { MidadProject } from "@/storage/project-schema";
import {
  fontRoles,
  motion,
  radius,
  spacing,
  springs,
  typeScale,
} from "@/theme";

import { useContextMenu } from "./use-context-menu";

const THUMB_RATIO = 4 / 3;
const ROW_THUMB_W = 116;
/** Reveal width per side. Wide enough for an icon + label, ≥44pt in both axes. */
const ACTION_W = 84;
/**
 * Room each panel keeps beyond the reveal width, for the two things that push
 * the card past `ACTION_W`: the rubber-band give in the drag, whose asymptote is
 * exactly this, and the overshoot of the latch spring.
 *
 * It is a *static* width — DESIGN.md §6 animates transform and opacity only —
 * and the card's own translate does the clipping, so the panel's inner edge and
 * the card's leading edge stay welded together and no sliver of page background
 * can open up between them. A panel exactly `ACTION_W` wide is what makes that
 * sliver visible, because a reveal can always travel further than the action.
 */
const ELASTIC_TRAVEL = 48;
/** Panel width: the reveal plus its give. Also the far limit of the drag. */
const PANEL_W = ACTION_W + ELASTIC_TRAVEL;
/**
 * Fastest release velocity handed to the settle spring (dp/s).
 *
 * The bounce past a latch is ≈ `0.0288 · v` for ζ 0.6 / stiffness 300, so an
 * unclamped 2000dp/s flick would travel ~58dp — past `ELASTIC_TRAVEL`, and back
 * into the sliver this layout exists to prevent. The commit decision still uses
 * the raw velocity; only the spring is damped into range.
 */
const MAX_SETTLE_VELOCITY = 1200;
/** Fraction of ACTION_W the release point must pass to latch open. */
const COMMIT_RATIO = 0.4;
/**
 * Least distance a flick must travel before its velocity may decide the commit.
 * Velocity alone would latch a row the finger barely moved, which then reads as
 * a swipe that refused to go back.
 */
const FLICK_FLOOR = ACTION_W * 0.15;

/**
 * The settle preset is chosen by *destination*, not by who asked for it.
 *
 * A latch wants the bounce — that give is the elastic. A return to rest must not
 * have one: overshooting past 0 reveals the action on the other side of the row
 * for a few frames. Both the gesture and the parent-state effect settle through
 * these, which also keeps Reanimated on its "continue the previous run" path
 * when the effect re-asserts the target the gesture just chose.
 */
const LATCH_SPRING = springs.elastic;
const REST_SPRING = springs.exit;

/** Which action a row has revealed, if any. */
export type SwipeSide = "leading" | "trailing" | null;

export interface ProjectRowProps {
  project: MidadProject;
  thumbUri: string | null;
  /** `row` = full-width phone row; `stack` = grid tile. */
  layout: "row" | "stack";
  /** Whether the swipe gesture is available: native only, and only in `row`. */
  swipeable: boolean;
  /** Only one row may be open at a time; the parent owns which. */
  openSide: SwipeSide;
  onOpenChange: (side: SwipeSide) => void;
  onPress: () => void;
  onMenu: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}

function formatDate(iso: string, language: string): string {
  const d = new Date(iso);
  // Latin digits for Arabic too (`ar-u-nu-latn`) — numerals stay Western by default.
  return d.toLocaleDateString(language === "ar" ? "ar-u-nu-latn" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * One gallery design: card + its row actions.
 *
 * **Swipe is gated by layout, not platform.** It is only offered in the
 * full-width `row` layout on native. In the 2–6 column grid a tile is ~168px
 * wide, where a horizontal drag is cramped and reads as ambiguous — and on web
 * a mouse drag is undiscoverable — so those get an overflow `⋯` button (plus
 * right-click on web) offering the identical actions.
 *
 * The gesture follows the pattern in `onboarding/step-pager.tsx`:
 * `activeOffsetX`/`failOffsetY` keep vertical FlashList scrolling working, the
 * offset is anchored at activation so the card never jumps, and direction uses
 * `useT().isRTL` rather than `I18nManager.isRTL` — the latter is stale until
 * the app restarts after a language change (`src/i18n/rtl.ts`).
 *
 * **A release always settles somewhere.** Past `COMMIT_RATIO` — and only once
 * the finger has actually travelled — the row latches and the spring is allowed
 * to overshoot, because that give is what makes the reveal feel elastic.
 * Anything less returns to rest on a critically damped spring, since a bounce
 * past 0 would flash the action on the other side. The row also cancels itself
 * as soon as it stops being the thing being touched: another row opening, a tap,
 * a list scroll, or leaving the screen.
 */
export function ProjectRow({
  project,
  thumbUri,
  layout,
  swipeable,
  openSide,
  onOpenChange,
  onPress,
  onMenu,
  onTogglePin,
  onDelete,
}: ProjectRowProps) {
  const { t, language, isRTL } = useT();
  const { colors: c } = useTheme();
  const fonts = fontRoles[language];
  const reduceMotion = useReducedMotion();
  const pinned = usePins((s) => s.pinnedIds.includes(project.id));
  const contextMenuRef = useContextMenu(onMenu);

  const name = project.name || t.gallery.untitled;
  const date = formatDate(project.updatedAt, language);
  const isRow = layout === "row";

  // Positive = reveal the leading action, negative = the trailing one,
  // *before* the RTL multiplier. `dir` flips it so "swipe toward the trailing
  // edge" is the same intent in both directions.
  const dir = isRTL ? -1 : 1;
  const x = useSharedValue(0);
  const startX = useSharedValue(0);

  const targetFor = useCallback(
    (side: SwipeSide) =>
      side === null ? 0 : (side === "trailing" ? -1 : 1) * ACTION_W * dir,
    [dir],
  );

  // Follow the parent's state (another row opened, or this one was closed).
  useEffect(() => {
    const target = targetFor(openSide);
    if (x.value === target) {
      return;
    }
    // The same preset rule the gesture's own settle uses, so an in-flight bounce
    // is continued rather than restarted when this re-asserts the same target.
    // `velocity: 0` leaves it to Reanimated to add the running animation's
    // velocity, which is what carries the release momentum across the round trip.
    x.value = reduceMotion
      ? withTiming(target, { duration: motion.fast })
      : withSpring(target, {
          ...(openSide === null ? REST_SPRING : LATCH_SPRING),
          velocity: 0,
        });
  }, [openSide, targetFor, reduceMotion, x]);

  const pan = Gesture.Pan()
    .enabled(swipeable)
    // Let vertical drags scroll the list; only claim clearly horizontal ones.
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onStart(() => {
      // Anchor at activation so an already-open row does not jump to zero.
      startX.value = x.value;
    })
    .onUpdate((e) => {
      // Past the reveal the drag gives instead of stopping at a wall: the
      // resistance grows with the distance, so the gesture reads as a material
      // under tension rather than a slider that hit its end. `ELASTIC_TRAVEL` is
      // the asymptote — which is also exactly how much extra panel there is to
      // reveal, so the stretched panel still covers what the card uncovers.
      const next = startX.value + e.translationX;
      const over = Math.abs(next) - ACTION_W;
      // eslint-disable-next-line react-hooks/immutability
      x.value =
        over <= 0
          ? next
          : Math.sign(next) *
            (ACTION_W + (ELASTIC_TRAVEL * over) / (over + ELASTIC_TRAVEL));
    })
    .onEnd((e) => {
      // Where the row would come to rest if released now, so a flick latches
      // open without the user having to drag all the way. The floor stops the
      // velocity deciding on its own: a twitch that never moved the card has to
      // return it, not latch it.
      const projected = startX.value + e.translationX + e.velocityX * 0.15;
      const ratio = (projected * dir) / ACTION_W;
      const travelled = Math.abs(e.translationX) >= FLICK_FLOOR;
      const side: SwipeSide =
        ratio < -COMMIT_RATIO && travelled
          ? "trailing"
          : ratio > COMMIT_RATIO && travelled
            ? "leading"
            : null;
      const target =
        side === null ? 0 : (side === "trailing" ? -1 : 1) * ACTION_W * dir;
      // Hand the release velocity to the settling spring, so a flick carries
      // through instead of restarting from a standstill — the same handoff the
      // onboarding pager makes (step-pager.tsx) — and settle with the preset the
      // destination calls for: the latch bounces, the return snaps.
      // eslint-disable-next-line react-hooks/immutability
      x.value = reduceMotion
        ? withTiming(target, { duration: motion.fast })
        : withSpring(target, {
            ...(side === null ? REST_SPRING : LATCH_SPRING),
            velocity: Math.min(
              MAX_SETTLE_VELOCITY,
              Math.max(-MAX_SETTLE_VELOCITY, e.velocityX),
            ),
          });
      runOnJS(onOpenChange)(side);
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  // A tap on an open row closes it rather than navigating — otherwise the
  // revealed action is impossible to dismiss without deleting something.
  const handlePress = useCallback(() => {
    if (openSide !== null) {
      onOpenChange(null);
      return;
    }
    onPress();
  }, [onOpenChange, openSide, onPress]);

  const handleAccessibilityAction = useCallback(
    (event: { nativeEvent: { actionName: string } }) => {
      switch (event.nativeEvent.actionName) {
        case "activate":
          onPress();
          break;
        case "pin":
        case "unpin":
          onTogglePin();
          break;
        case "delete":
          onDelete();
          break;
        default:
          break;
      }
    },
    [onDelete, onPress, onTogglePin],
  );

  // Swipe actions are invisible to screen readers and keyboards, so the same
  // operations are exposed as custom actions.
  const accessibilityActions = [
    { name: "activate", label: t.common.open },
    {
      name: pinned ? "unpin" : "pin",
      label: pinned ? t.gallery.unpin : t.gallery.pin,
    },
    { name: "delete", label: t.common.delete },
  ];
  const accessibilityLabel = `${name}, ${date}${pinned ? `, ${t.gallery.pinned}` : ""}`;

  const card = (
    <Card
      onPress={handlePress}
      onLongPress={onMenu}
      style={[
        isRow ? styles.cardRow : styles.cardStack,
        isRow && rowStyle(isRTL),
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={handleAccessibilityAction}
    >
      <View
        style={[
          styles.thumb,
          isRow && styles.thumbRow,
          { backgroundColor: c.surfaceAlt, borderColor: c.border },
        ]}
      >
        {thumbUri ? (
          <Image
            source={{ uri: thumbUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
          />
        ) : (
          <Icon name="pen" color={c.faint} size={22} />
        )}
      </View>
      <View style={isRow ? styles.cardBodyRow : styles.cardBody}>
        <View style={[styles.nameRow, rowStyle(isRTL)]}>
          <Text
            numberOfLines={1}
            style={[styles.cardName, { fontFamily: fonts.ui, color: c.ink }]}
          >
            {name}
          </Text>
          {pinned ? (
            <Icon name="pin" size={13} color={c.accentText} weight="fill" />
          ) : null}
        </View>
        <Text
          style={[styles.cardDate, { fontFamily: fonts.ui, color: c.faint }]}
        >
          {date}
        </Text>
      </View>
      {isRow ? (
        <View style={styles.rowChevron}>
          <DirectionIcon isRTL={isRTL} color={c.faint} size={18} />
        </View>
      ) : null}
    </Card>
  );

  // Grid tiles and web keep an always-visible entry point to the full menu.
  const overflow = swipeable ? null : (
    <View
      style={[
        styles.overflow,
        { top: spacing.sm, end: spacing.sm, pointerEvents: "box-none" },
      ]}
    >
      <IconButton
        onPress={onMenu}
        variant="surface"
        size={44}
        accessibilityLabel={t.gallery.rowActions}
        hint={t.gallery.rowActions}
      >
        <Icon name="more" size={18} color={c.muted} />
      </IconButton>
    </View>
  );

  if (!swipeable) {
    return (
      <View style={[styles.wrap, styles.wrapStack]} ref={contextMenuRef}>
        {card}
        {overflow}
      </View>
    );
  }

  return (
    <View style={styles.wrap} ref={contextMenuRef}>
      {/* Sits behind the card, revealing the side the swipe latched onto. Each
          panel is wider than its action and keeps that action against the outer
          edge, so the panel's inner edge is always past wherever the card can
          stop: the reveal is clipped by the card, never left with a gap. */}
      <View style={[styles.actions, rowStyle(isRTL)]}>
        <View
          style={[
            styles.panel,
            rowStyle(isRTL),
            { backgroundColor: c.surfaceAlt },
          ]}
        >
          <Pressable
            onPress={onTogglePin}
            accessibilityRole="button"
            accessibilityLabel={pinned ? t.gallery.unpin : t.gallery.pin}
            style={styles.action}
          >
            <Icon
              name="pin"
              size={18}
              color={pinned ? c.accentText : c.muted}
              weight={pinned ? "fill" : "regular"}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.actionLabel,
                {
                  color: pinned ? c.accentText : c.muted,
                  fontFamily: fonts.ui,
                },
              ]}
            >
              {pinned ? t.gallery.unpin : t.gallery.pin}
            </Text>
          </Pressable>
        </View>
        <View
          style={[
            styles.panel,
            styles.panelEnd,
            rowStyle(isRTL),
            { backgroundColor: c.danger },
          ]}
        >
          <Pressable
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={t.common.delete}
            style={styles.action}
          >
            <Icon name="trash" size={18} color={c.onInk} />
            <Text
              numberOfLines={1}
              style={[
                styles.actionLabel,
                { color: c.onInk, fontFamily: fonts.ui },
              ]}
            >
              {t.common.delete}
            </Text>
          </Pressable>
        </View>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={cardStyle}>{card}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // Clips the card as it slides out of the row.
    overflow: "hidden",
    borderRadius: radius.lg,
    marginHorizontal: spacing.xs,
  },
  wrapStack: {
    // Grid tiles never translate, so nothing needs clipping — and clipping
    // would cut off the card's own border radius.
    overflow: "visible",
  },
  actions: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "space-between",
  },
  panel: {
    // Wider than one action on purpose: the card can travel as far as PANEL_W
    // (the drag's asymptote, plus the latch spring's overshoot), and this is what
    // keeps revealed background under the card's edge the whole way there.
    width: PANEL_W,
  },
  panelEnd: {
    // Pins the action to the outer edge of the trailing panel. Works in both
    // directions because the panel's own row is `rowStyle(isRTL)` too: the
    // trailing edge is `flex-end` in LTR and in an auto-mirrored RTL layout
    // alike, and `row-reverse` swaps it for the pre-restart case.
    justifyContent: "flex-end",
  },
  action: {
    width: ACTION_W,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
  },
  actionLabel: {
    fontSize: typeScale.micro.size,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardStack: {
    // Only the grid needs this: tiles must fill the item width. In the row
    // layout the card sits inside an auto-height parent, where a positive
    // `flex` gives it a zero flex-basis and collapses it — the sizing trap
    // documented in onboarding/step-pager.tsx.
    flex: 1,
  },
  thumb: {
    aspectRatio: THUMB_RATIO,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
  },
  thumbRow: {
    width: ROW_THUMB_W,
    height: ROW_THUMB_W / THUMB_RATIO,
    borderEndWidth: 1,
    borderBottomWidth: 0,
  },
  rowChevron: {
    marginEnd: spacing.lg,
  },
  cardBody: {
    padding: spacing.md,
    gap: spacing.xxs,
  },
  cardBodyRow: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  nameRow: {
    alignItems: "center",
    gap: spacing.xs,
  },
  cardName: {
    flex: 1,
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
    fontWeight: "600",
  },
  cardDate: {
    fontSize: typeScale.caption.size,
  },
  overflow: {
    position: "absolute",
  },
});
