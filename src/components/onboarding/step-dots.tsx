import { StyleSheet, View } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { rowStyle } from "@/i18n/rtl";
import { radius, spacing } from "@/theme";

const DOT_HEIGHT = 7;
/** Current step: elongated pill so progress reads at a glance. */
const ACTIVE_DOT_WIDTH = 28;
const INACTIVE_DOT_WIDTH = DOT_HEIGHT;

export function StepDots({
  count,
  index,
  isRTL = false,
}: {
  count: number;
  index: number;
  isRTL?: boolean;
}) {
  const { colors: c } = useTheme();
  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: count, now: index + 1 }}
      accessibilityLabel={`${index + 1} / ${count}`}
    >
      {/* Dots are ordered step 1 → last, so the row has to mirror for RTL:
          step 1 sits at the trailing (right) edge and progress walks left. */}
      <View style={[styles.row, rowStyle(isRTL)]}>
        {Array.from({ length: count }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i === index ? c.ink : c.border,
                width: i === index ? ACTIVE_DOT_WIDTH : INACTIVE_DOT_WIDTH,
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
    height: DOT_HEIGHT,
    borderRadius: radius.pill,
  },
});
