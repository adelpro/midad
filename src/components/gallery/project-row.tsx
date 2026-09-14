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
/** Fraction of ACTION_W the release point must pass to latch open. */
const COMMIT_RATIO = 0.4;
/** How much of a drag past the reveal width is allowed through, as friction. */
const OVERDRAG_RESISTANCE = 0.15;

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
    x.value = reduceMotion
      ? withTiming(target, { duration: motion.fast })
      : withSpring(target, springs.momentum);
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
      const next = startX.value + e.translationX;
      // Past the reveal width the drag meets friction rather than an invisible
      // wall — real things slow before they stop, and the resistance is what
      // tells the user they have gone far enough.
      // eslint-disable-next-line react-hooks/immutability
      x.value =
        next > ACTION_W
          ? ACTION_W + (next - ACTION_W) * OVERDRAG_RESISTANCE
          : next < -ACTION_W
            ? -ACTION_W + (next + ACTION_W) * OVERDRAG_RESISTANCE
            : next;
    })
    .onEnd((e) => {
      // Where the row would come to rest if released now, so a flick latches
      // open without the user having to drag all the way.
      const projected = startX.value + e.translationX + e.velocityX * 0.15;
      const ratio = (projected * dir) / ACTION_W;
      const side: SwipeSide =
        ratio < -COMMIT_RATIO
          ? "trailing"
          : ratio > COMMIT_RATIO
            ? "leading"
            : null;
      const target =
        side === null ? 0 : (side === "trailing" ? -1 : 1) * ACTION_W * dir;
      // Hand the release velocity to the settling spring, so a flick carries
      // through instead of restarting from a standstill — the same handoff the
      // onboarding pager makes (step-pager.tsx).
      // eslint-disable-next-line react-hooks/immutability
      x.value = reduceMotion
        ? withTiming(target, { duration: motion.fast })
        : withSpring(target, { ...springs.momentum, velocity: e.velocityX });
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
      {/* Sits behind the card, revealing the side the swipe latched onto. */}
      <View style={[styles.actions, rowStyle(isRTL)]}>
        <Pressable
          onPress={onTogglePin}
          accessibilityRole="button"
          accessibilityLabel={pinned ? t.gallery.unpin : t.gallery.pin}
          style={[styles.action, { backgroundColor: c.surfaceAlt }]}
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
              { color: pinned ? c.accentText : c.muted, fontFamily: fonts.ui },
            ]}
          >
            {pinned ? t.gallery.unpin : t.gallery.pin}
          </Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={t.common.delete}
          style={[styles.action, { backgroundColor: c.danger }]}
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
