import {
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";

import { springs } from "@/theme";

/**
 * Press feedback scale (DESIGN.md §4). Subtle enough to read as material
 * flexing rather than the control shrinking.
 */
export const PRESS_SCALE = 0.97;

export interface PressFeedback {
  /** 1 while the pointer is down, 0 otherwise. Drives colour/opacity changes. */
  pressed: SharedValue<number>;
  /** 1 at rest; snaps to `PRESS_SCALE` on touch-down and springs back on release. */
  scale: SharedValue<number>;
  onPressIn: () => void;
  onPressOut: () => void;
}

/**
 * Shared press feedback for every pressable surface in the kit.
 *
 * Deliberately asymmetric: the **press** is instant — the response has to land
 * on touch-down or the control reads as dead — while the **release** settles by
 * spring, which is what makes a button feel like physical material
 * (DESIGN.md §6, "respond on pointer-down").
 *
 * Reduce Motion keeps the colour/opacity change and drops the scale. Driving
 * both from shared values (rather than React state) keeps the feedback off the
 * JS thread, so it still lands while a list is mounting or a screen is
 * transitioning.
 */
export function usePressFeedback(): PressFeedback {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const scale = useSharedValue(1);

  // Plain handlers, not `useCallback`: the shared values they write are stable
  // for the lifetime of the component, and wrapping the writes in a memo only
  // trips the compiler's immutability rule without buying anything — the
  // consumers re-render on theme/locale changes regardless.
  const onPressIn = () => {
    pressed.value = 1;
    scale.value = reduceMotion ? 1 : PRESS_SCALE;
  };

  const onPressOut = () => {
    pressed.value = 0;
    scale.value = reduceMotion ? 1 : withSpring(1, springs.ui);
  };

  return { pressed, scale, onPressIn, onPressOut };
}
