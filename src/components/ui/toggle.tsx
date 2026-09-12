import { Switch, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "@/hooks/use-theme";

export interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Toggle({
  value,
  onValueChange,
  accessibilityLabel,
  style,
}: ToggleProps) {
  const { colors: c } = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      accessibilityLabel={accessibilityLabel}
      trackColor={{ false: c.border, true: c.accent }}
      thumbColor={value ? c.onInk : c.surfaceAlt}
      ios_backgroundColor={c.border}
      style={style}
    />
  );
}