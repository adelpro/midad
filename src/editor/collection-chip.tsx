import { useCallback, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { Icon } from "@/components/ui";
import { frameTopCentre, type CollectionFrame } from "@/editor/groups";
import { useEditorStore } from "@/editor/store";
import { useTheme } from "@/hooks/use-theme";
import { useT } from "@/i18n";
import { rowStyle } from "@/i18n/rtl";
import { fontRoles, radius, spacing, typeScale } from "@/theme";

/** Gap (view px) between the frame's top edge and the chip. */
const CHIP_GAP = 8;
/** Inset (view px) the chip keeps from the canvas edges. */
const CHIP_MARGIN = 4;

export interface CollectionChipProps {
  /** The box the chip is anchored to, in design units. */
  frame: CollectionFrame;
  /**
   * What the chip says, already resolved: the element count for a whole
   * selection, the member's position while a collection is entered.
   */
  text: string;
  accessibilityLabel: string;
  accessibilityHint: string;
  /**
   * The way back to the whole collection, offered only while one is entered.
   * Absent makes the chip a plain label — there is nothing to go back to.
   */
  onPress?: () => void;
  /** Which glyph leads the text. */
  mode: "whole" | "entered";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The pill above a whole selection: how many elements it is, and — while a
 * collection is entered — which member is being edited, with the way back out.
 *
 * It replaces the count badge that used to sit at the head of the selection rail.
 * Two reasons for the move. The rail is where the *actions* live, and a badge
 * there was charged against their width budget — twice over, since it also shrank
 * the context strip's share. And a label that describes the selection belongs on
 * the selection, beside the box it is talking about.
 *
 * Rendered as a plain React Native view in the canvas wrapper, next to
 * `LearnOverlay` and outside the gesture detector, so it cannot resize the canvas
 * (which would re-run fit-to-view and visibly zoom the design) and so it can be a
 * real, accessible control rather than a painted glyph. Its own layer is
 * `box-none`, so the canvas keeps every touch that is not on the chip.
 */
export function CollectionChip({
  frame,
  text,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  mode,
}: CollectionChipProps) {
  const { colors: c } = useTheme();
  const { language, isRTL } = useT();
  const fonts = fontRoles[language];
  const { scale, offsetX, offsetY, w, h } = useEditorStore((s) => s.viewport);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);

  // The frame's top edge in view px, so the chip tracks pan and zoom with the
  // box rather than with the selection's screen position at the time it mounted.
  const anchor = frameTopCentre(frame);
  const centreX = anchor.x * scale + offsetX;
  const centreY = anchor.y * scale + offsetY;
  const left = clamp(
    centreX - size.width / 2,
    CHIP_MARGIN,
    Math.max(CHIP_MARGIN, w - size.width - CHIP_MARGIN),
  );
  const top = clamp(
    centreY - size.height - CHIP_GAP,
    CHIP_MARGIN,
    Math.max(CHIP_MARGIN, h - size.height - CHIP_MARGIN),
  );

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <Pressable
        onPress={onPress}
        onLayout={onLayout}
        disabled={!onPress}
        accessibilityRole={onPress ? "button" : "text"}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={[
          styles.chip,
          rowStyle(isRTL),
          {
            left,
            top,
            backgroundColor: c.surface,
            borderColor: c.border,
          },
        ]}
      >
        <Icon
          name={
            mode === "entered"
              ? isRTL
                ? "chevronRight"
                : "chevronLeft"
              : "group"
          }
          size={13}
          color={c.muted}
        />
        <Text style={[styles.text, { color: c.ink, fontFamily: fonts.ui }]}>
          {text}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  chip: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    height: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontSize: typeScale.micro.size,
    lineHeight: typeScale.micro.lineHeight,
  },
});
