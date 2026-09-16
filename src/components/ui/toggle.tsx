import { Host, Switch } from "@expo/ui";
import type { StyleProp, ViewStyle } from "react-native";

import { useTheme } from "@/hooks/use-theme";

export interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The app's one toggle, built on `@expo/ui`'s universal `Switch`: SwiftUI
 * `Toggle` on iOS, Material 3 `Switch` on Android and a DOM-backed switch on
 * web, all from this single import.
 *
 * It replaced React Native's `Switch` because that is the one control
 * react-native-web renders wrong in Arabic — it positions the on-state thumb
 * with a physical `inset-inline-start: 100%` next to a *logical* negative
 * `marginStart` (`react-native-web/dist/exports/Switch/index.js`), so under
 * `dir="rtl"` the knob leaves the track. The same file also reads
 * `activeThumbColor` — not `thumbColor` — for the on state, which is why an
 * untinted knob came out RNW's default teal. The universal switch owns its own
 * geometry on every platform, so neither quirk is ours to work around.
 *
 * `seedColor` carries the accent into the SwiftUI tint, the Material palette and
 * the web CSS variables, and `colorScheme` keeps the web switch on the app's
 * theme rather than the OS one (the app's theme is a user setting).
 */
export function Toggle({
  value,
  onValueChange,
  accessibilityLabel,
  style,
}: ToggleProps) {
  const { colors: c, isDark } = useTheme();
  return (
    <Host
      matchContents
      seedColor={c.accent}
      colorScheme={isDark ? "dark" : "light"}
      style={style}
      // RN maps `aria-label` onto `accessibilityLabel` natively; on web it lands
      // on the host element wrapping the real `role="switch"` input.
      aria-label={accessibilityLabel}
    >
      <Switch value={value} onValueChange={onValueChange} />
    </Host>
  );
}
