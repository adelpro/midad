/**
 * Pure geometry and release logic for the gallery row's swipe-to-reveal.
 *
 * Split out of `project-row.tsx` for two reasons: the constants are load-bearing
 * and had no names, and the release decision is the kind of pure function this
 * repo pins with a `check-*.mjs` script (`scripts/check-swipe.mjs`). That check
 * transpiles this file standalone, so it must declare **no imports** — importing
 * anything, value or type, silently breaks the script.
 *
 * `rubberband`, `projectPosition`, `resolveSwipeSide`, `settleTarget` and
 * `clampSettleVelocity` carry a `'worklet'` directive: `project-row.tsx` calls
 * them from inside gesture callbacks, which are worklets. Remove a directive and
 * the gesture throws on the UI thread the first time it runs.
 */

/** Which action a row has revealed, if any. */
export type SwipeSide = 'leading' | 'trailing' | null;

/** Reveal width per side. Wide enough for an icon + label, ≥44pt in both axes. */
export const ACTION_W = 84;

/**
 * Room each panel keeps beyond the reveal width, for the two things that push
 * the card past `ACTION_W`: the rubber-band give in the drag, whose asymptote is
 * exactly this, and the overshoot of the latch spring.
 *
 * It is a *static* width — DESIGN.md §6 animates transform and opacity only —
 * and the card's own translate does the clipping, so the panel's inner edge and
 * the card's leading edge stay welded together and no sliver of page background
 * can open up between them. A panel exactly `ACTION_W` wide is what makes that
 * sliver visible, because a reveal can always travel further than the action.
 */
export const ELASTIC_TRAVEL = 48;

/** Panel width: the reveal plus its give. Also the far limit of the drag. */
export const PANEL_W = ACTION_W + ELASTIC_TRAVEL;

/** Fraction of ACTION_W the projected release point must pass to latch open. */
export const COMMIT_RATIO = 0.4;

/**
 * Least distance a flick must travel before its velocity may decide the commit.
 * Velocity alone would latch a row the finger barely moved, which then reads as
 * a swipe that refused to go back.
 */
export const FLICK_FLOOR = ACTION_W * 0.15;

/**
 * Fastest release velocity handed to the settle spring (dp/s).
 *
 * The bounce past a latch is ≈ `0.0288 · v` for ζ 0.6 / stiffness 300, so an
 * unclamped 2000dp/s flick would travel ~58dp — past `ELASTIC_TRAVEL`, and back
 * into the sliver this layout exists to prevent. The commit decision still uses
 * the raw velocity; only the spring is damped into range.
 */
export const MAX_SETTLE_VELOCITY = 1200;

/**
 * Momentum-projection window applied to the release velocity, in seconds.
 *
 * The resting point is `position + velocity · PROJECTION_SECONDS`, the discrete
 * form of Apple's exponential projection `(v / 1000) · d / (1 − d)`. `0.15`
 * corresponds to a deceleration rate `d ≈ 0.9934` — between the standard scroll
 * `0.998` and the snappier `0.99`, which is the "small input, confident throw"
 * feel this row wants.
 */
export const PROJECTION_SECONDS = 0.15;

/** Final x for a side, before the RTL multiplier. `dir` is 1 (LTR) or -1 (RTL). */
export function settleTarget(side: SwipeSide, dir: number): number {
  'worklet';
  if (side === null) return 0;
  return (side === 'trailing' ? -1 : 1) * ACTION_W * dir;
}

/**
 * Progressive resistance past the reveal: the further past `ACTION_W`, the less
 * the card follows, asymptotic to `ACTION_W + give`. Real things slow before
 * they stop, so this reads as material under tension rather than a slider that
 * hit its end. `give` defaults to `ELASTIC_TRAVEL`, the panel's own spare room.
 */
export function rubberband(
  next: number,
  actionWidth = ACTION_W,
  give = ELASTIC_TRAVEL,
): number {
  'worklet';
  const over = Math.abs(next) - actionWidth;
  if (over <= 0) return next;
  return Math.sign(next) * (actionWidth + (give * over) / (over + give));
}

/** Where the card would come to rest if released now. */
export function projectPosition(
  startX: number,
  translationX: number,
  velocityX: number,
): number {
  'worklet';
  return startX + translationX + velocityX * PROJECTION_SECONDS;
}

/**
 * The side a release commits to, or `null` for a return to rest.
 *
 * Direction uses the RTL multiplier `dir`, so "swipe toward the trailing edge"
 * is the same intent in both reading directions. A commit needs **both** a
 * projected point past `COMMIT_RATIO` and real travel past `FLICK_FLOOR`: a
 * twitch that never moved the card must return it, not latch it.
 */
export function resolveSwipeSide(args: {
  startX: number;
  translationX: number;
  velocityX: number;
  dir: number;
}): SwipeSide {
  'worklet';
  const projected = projectPosition(
    args.startX,
    args.translationX,
    args.velocityX,
  );
  const ratio = (projected * args.dir) / ACTION_W;
  const travelled = Math.abs(args.translationX) >= FLICK_FLOOR;
  if (ratio < -COMMIT_RATIO && travelled) return 'trailing';
  if (ratio > COMMIT_RATIO && travelled) return 'leading';
  return null;
}

/** Clamp a release velocity into the range the panel can absorb. */
export function clampSettleVelocity(
  velocityX: number,
  max = MAX_SETTLE_VELOCITY,
): number {
  'worklet';
  return Math.min(max, Math.max(-max, velocityX));
}
