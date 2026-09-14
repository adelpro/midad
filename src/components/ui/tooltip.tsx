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
   * rails. Chrome pinned to the top of the screen has to flip: those controls
   * sit at y 0 on the web, where `SafeAreaView` reports no inset, so a bubble
   * above them lands outside the viewport instead of over the status bar.
   */
  placement?: "above" | "below";
}

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
