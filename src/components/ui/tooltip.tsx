import type { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { radius, spacing, typeScale } from "@/theme";

export interface TooltipProps extends PropsWithChildren {
  label: string;
  visible: boolean;
}

export function Tooltip({ label, visible, children }: TooltipProps) {
  const { colors: c } = useTheme();
  return (
    <View style={styles.anchor}>
      {children}
      {visible && (
        <View
          pointerEvents="none"
          style={[styles.bubble, { backgroundColor: c.ink }]}
        >
          <Text style={[styles.text, { color: c.onInk }]}>{label}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: "relative", zIndex: 10 },
  bubble: {
    position: "absolute",
    bottom: "100%",
    left: "50%",
    maxWidth: 220,
    minWidth: 80,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    transform: [{ translateX: -40 }],
    marginBottom: spacing.xs,
  },
  text: {
    fontFamily: "monospace",
    fontSize: typeScale.micro.size,
    lineHeight: typeScale.micro.lineHeight,
    textAlign: "center",
  },
});