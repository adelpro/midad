import type { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { radius, spacing, typeScale } from "@/theme";

export interface TooltipProps extends PropsWithChildren {
  label: string;
  visible: boolean;
  /**
   * Which side of the trigger the bubble sits on.
   *
   * The default clears the trigger upward, which suits the editor's bottom
   * rails. Chrome pinned to the top of the screen has to flip: a bubble above a
   * control that sits at the very top of the window would land over the
   * status-bar strip, where it is clipped rather than read.
   */
  placement?: "above" | "below";
}

/**
 * The transient name bubble behind `IconButton`'s `hint`.
 *
 * A bubble is an *additional* label, never the only one: it is native-only
 * (`ui/icon-button.tsx` never opens one on web, where learn mode is the naming
 * route instead) and it is suppressed outright while a control claims its own
 * long-press. So always pass `accessibilityLabel` too — the bubble is a
 * convenience, not the control's name.
 */
export function Tooltip({
  label,
  visible,
  placement = "above",
  children,
}: TooltipProps) {
  const { colors: c } = useTheme();
  const wrapStyle =
    placement === "above" ? styles.bubbleWrapAbove : styles.bubbleWrapBelow;
  return (
    <View style={styles.anchor}>
      {children}
      {visible && (
        <View pointerEvents="none" style={wrapStyle}>
          <View style={[styles.bubble, { backgroundColor: c.ink }]}>
            <Text style={[styles.text, { color: c.onInk }]}>{label}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: "relative", zIndex: 10 },
  // Both wrap variants span the anchor so the bubble centres on the trigger at
  // any width. The old fixed `translateX: -40` only lined up for one bubble
  // size.
  bubbleWrapAbove: {
    position: "absolute",
    bottom: "100%",
    left: 0,
    right: 0,
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  bubbleWrapBelow: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  bubble: {
    maxWidth: 220,
    minWidth: 80,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  text: {
    fontFamily: "monospace",
    fontSize: typeScale.micro.size,
    lineHeight: typeScale.micro.lineHeight,
    textAlign: "center",
  },
});
