import { useEffect } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/theme';

/**
 * The wait-state motion for a row that is doing asynchronous work — an icon being
 * fetched, a photo being written.
 *
 * ## Why this exists at all
 *
 * The gate before writing it: a row that can be tapped to start a network round
 * trip or a disk write is *not* a 100+/day interaction, so it earns motion — but
 * barely, and only for one named purpose: **preventing a jarring change**. Before
 * this the row simply froze; a spinner appeared next to static text and nothing
 * else moved, so a slow fetch read as a dead control rather than a busy one.
 *
 * ## What it does, and what it deliberately does not
 *
 * Two channels, both already free (opacity, transform):
 *
 * - **Opacity** drops while busy and returns on settle. This is the whole effect
 *   on its own.
 * - **A 1% scale** while busy, under the press feedback's own 0.97, so the two
 *   never fight: the row recedes slightly when it is working and the press still
 *   reads as the press.
 *
 * No height, no colour tween, no indeterminate shimmer, no stagger. Animating the
 * row's height would re-run Yoga on every sibling in the list — 32 rows
 * re-laying-out per frame to express one row's state.
 *
 * **Reduce Motion keeps the opacity and drops the scale.** The state change is
 * information; only the travel is decoration, and this skill's rule is fewer and
 * gentler rather than zero.
 *
 * Both values are timing curves, not springs: no finger is on the element while it
 * works, so there is no velocity to carry, and a spring here would overshoot a
 * state fade.
 */
const BUSY_OPACITY = 0.55;
const BUSY_SCALE = 0.99;

export function useRowWaitMotion(busy: boolean) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(busy ? 1 : 0);

  useEffect(() => {
    progress.set(
      withTiming(busy ? 1 : 0, {
        duration: motion.fast,
        // The repo's EaseOutQuint, as a cubic-bezier. Ease-out in **both**
        // directions on purpose: entering and leaving a wait state are each a
        // response to something that just happened, which is the case the easing
        // table gives ease-out for. A spring would be wrong here — no finger is on
        // the element while it works, so there is no velocity to carry, and it
        // would overshoot a state fade.
        easing: Easing.bezier(...motion.ease),
      }),
    );
  }, [busy, progress]);

  return useAnimatedStyle(() => {
    const t = progress.get();
    return {
      opacity: 1 - (1 - BUSY_OPACITY) * t,
      transform: reduceMotion ? [] : [{ scale: 1 - (1 - BUSY_SCALE) * t }],
    };
  });
}
