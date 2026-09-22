/**
 * Countdown math for the undo snackbar's ring and seconds label.
 *
 * Split into an import-free module so `scripts/check-countdown.mjs` can
 * transpile and evaluate it standalone. Both functions carry a `'worklet'`
 * directive: they are called from Reanimated animations on the UI thread, and a
 * plain function there throws at runtime with no linter warning.
 */

/**
 * Whole seconds left, for a progress value that runs 1 → 0 over the window.
 *
 * Rounded **up**, so the label never reads 0 while time still remains: at
 * `progress = 0.01` there is a fraction of a second left and it reads `1`, and
 * only a fully elapsed window reads `0`.
 */
export function secondsFromProgress(
  progress: number,
  durationMs: number,
): number {
  'worklet';
  const clamped = Math.min(1, Math.max(0, progress));
  return Math.ceil(clamped * (durationMs / 1000));
}

/**
 * `strokeDashoffset` for a progress ring that starts full and drains to empty.
 *
 * At `progress = 1` the offset is 0 (the whole arc is drawn); at `progress = 0`
 * it is the full circumference (nothing is drawn). Colours and stroke width are
 * the caller's; only the arithmetic lives here.
 */
export function countdownDashOffset(
  circumference: number,
  progress: number,
): number {
  'worklet';
  const clamped = Math.min(1, Math.max(0, progress));
  return circumference * (1 - clamped);
}
