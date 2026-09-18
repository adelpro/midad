import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';

/**
 * `Pressable` as a Reanimated component.
 *
 * Press feedback in this kit lives in shared values (see `usePressFeedback`),
 * so the animated style has to reach the `Pressable` **directly**. An animated
 * style nested inside Pressable's `({ pressed }) => …` style function never
 * updates: Reanimated writes props from the outside, while that function is
 * invoked inside Pressable and its result is never seen by Reanimated.
 *
 * So wherever this is used, `style` is a plain array of static styles plus the
 * animated style — the `pressed` boolean is not used for styling any more.
 */
export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
