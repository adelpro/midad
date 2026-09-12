import { StyleSheet, View } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { radius, spacing } from "@/theme";

export function StepDots({ count, index }: { count: number; index: number }) {
  const { colors: c } = useTheme();
  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: count, now: index + 1 }}
      accessibilityLabel={`${index + 1} / ${count}`}
    >
      <View style={styles.row}>
        {Array.from({ length: count }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i === index ? c.ink : c.border,
                width: i === index ? 18 : 7,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dot: {
    height: 7,
    borderRadius: radius.pill,
  },
});
