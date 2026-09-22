# Gallery Row Swipe Actions — Hardening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three defects found in the apple-design review of the gallery row swipe-to-reveal (`.tsx` `ProjectRow`): dormant actions stay reachable by assistive tech, the revealed actions have no press feedback, and the swipe's commit geometry lives as unexplained magic numbers inside a 538-line component.

**Architecture:** Three independently shippable phases. (1) Gate the always-mounted action layer behind `openSide`, so a closed row exposes nothing to VoiceOver, TalkBack, or the web tab order. (2) Lift the swipe's pure geometry and release-decision logic into `src/components/gallery/swipe.ts` — import-free, so the repo's standalone `check-*.mjs` pattern can transpile it — and pin it with `scripts/check-swipe.mjs`. (3) Extract the two revealed actions into a `RowAction` component driven by the shared `usePressFeedback` hook, so a press registers on touch-down (DESIGN.md §6, "respond on pointer-down").

**Tech Stack:** React Native 0.86.3 / Expo SDK 57, Reanimated 4 (`withSpring`, shared values), `react-native-gesture-handler`, TypeScript, the repo's own `typeScale` / `spacing` / `fontRoles` tokens. No test runner — verification is `node scripts/verify.mjs` plus the manual device checks written into each task.

**Spec:** the apple-design review of `src/components/gallery/project-row.tsx` in this session. Its three actionable findings drive the phases and the Review Focus list below.

## Global Constraints

- **The swipe geometry is already correct. Do not change its behavior.** Every constant and formula below is copied from the current `project-row.tsx`; the extraction in Phase 2 must be behavior-preserving. The one deliberate naming addition is `PROJECTION_SECONDS` (the literal `0.15`).
- **`src/components/gallery/swipe.ts` may declare no imports at all.** The check script transpiles and evaluates it standalone (`new Function`); a value import (or any import) breaks it silently, the same trap documented for `shortcuts.ts`, `help/catalog.ts` and `i18n/strings.ts`.
- **Every helper in `swipe.ts` that a gesture callback calls must carry a `'worklet'` directive.** `project-row.tsx` calls `rubberband`, `resolveSwipeSide`, `settleTarget` and `clampSettleVelocity` from inside `.onUpdate`/`.onEnd`, which `babel-preset-expo` workletizes. A plain function imported from another module is **not** workletized and throws "Tried to synchronously call a non-worklet function on the UI thread" at runtime. The directive is a no-op under the check script's plain `ts.transpileModule`, so the math assertions are unaffected.
- **Motion: springs only on interactive elements** (DESIGN.md §6/§8). Press feedback is instant on touch-down, settled by `springs.ui`; reduce-motion drops the scale but keeps the opacity change.
- **Animate `transform` + `opacity` only.** No width/height/left/top animation.
- **Touch targets stay ≥ 44pt.** `ACTION_W = 84` is unchanged.
- **Touch targets under 44pt, icon-only buttons without labels, linear tweens** are banned (DESIGN.md §8).
- **Docs that name the check count must be updated in the same commit as the new script:** `scripts/verify.mjs` header, `AGENTS.md`.
- **Run `node scripts/verify.mjs` before every commit.** It is the repo's single "is this tree OK?" command.

## Review Focus

The five failure modes the review implies but no current check exercises. Each line names the input and the behavior a reasonable person expects; the task that owns the code gets the test.

1. **A row left open while its project is deleted (undo snackbar) or the list reloads.** Expect no crash, no phantom action layer, and `openRow` cleared when the id disappears.
2. **A screen reader or keyboard on a *closed* row.** Expect Pin/Delete to be unreachable and unannounced — only the card's own custom actions present.
3. **Reduced-motion ON, press the revealed action.** Expect value/colour feedback but zero scale motion.
4. **A flick faster than `MAX_SETTLE_VELOCITY`.** Expect the panel to stay within `ELASTIC_TRAVEL`, so no page-background sliver opens between card and panel.
5. **Release exactly at the commit threshold, or below the flick floor.** Expect a deterministic return to rest, not a latch.

---

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/components/gallery/swipe.ts` | **Create** | Pure swipe geometry + release decision. No imports. Owns `SwipeSide`, `ACTION_W`, `ELASTIC_TRAVEL`, `PANEL_W`, `COMMIT_RATIO`, `FLICK_FLOOR`, `MAX_SETTLE_VELOCITY`, `PROJECTION_SECONDS`, `settleTarget`, `rubberband`, `projectPosition`, `resolveSwipeSide`, `clampSettleVelocity`. |
| `src/components/gallery/row-action.tsx` | **Create** | One revealed row action: icon + label + instant press feedback. Owns the action's touch-down response. |
| `src/components/gallery/project-row.tsx` | **Modify** | Consumes the two new modules; keeps gesture wiring, panel layout and the parent-state effect. Loses the local constants and the inline action markup. |
| `scripts/check-swipe.mjs` | **Create** | Standalone spec for `swipe.ts` (rubber-band, targets, commit decision, velocity clamp). |
| `scripts/verify.mjs` | **Modify** | Register `swipe`; fix "five" → "six" in the header. |
| `AGENTS.md` | **Modify** | "all five checks" → "all six"; add the `check-swipe.mjs` invocation to the per-script list. |

```ts
// src/components/gallery/swipe.ts — public interface (Phase 2 produces this)

export type SwipeSide = 'leading' | 'trailing' | null;

export const ACTION_W: number;            // 84
export const ELASTIC_TRAVEL: number;      // 48
export const PANEL_W: number;             // ACTION_W + ELASTIC_TRAVEL
export const COMMIT_RATIO: number;        // 0.4
export const FLICK_FLOOR: number;         // ACTION_W * 0.15
export const MAX_SETTLE_VELOCITY: number; // 1200
export const PROJECTION_SECONDS: number;  // 0.15

/** Final x for a side, before RTL. `dir` is 1 (LTR) or -1 (RTL). */
export function settleTarget(side: SwipeSide, dir: number): number;

/** Progressive resistance past ACTION_W, asymptotic to ACTION_W + give. */
export function rubberband(next: number, actionWidth?: number, give?: number): number;

/** Momentum projection: where the card rests if released now. */
export function projectPosition(startX: number, translationX: number, velocityX: number): number;

/** The side a release commits to, or null for a return to rest. */
export function resolveSwipeSide(args: {
  startX: number;
  translationX: number;
  velocityX: number;
  dir: number;
}): SwipeSide;

/** Clamp a release velocity into the range the panel can absorb. */
export function clampSettleVelocity(velocityX: number, max?: number): number;
```

---

# Phase 1 — Accessibility gate on the dormant action layer

**Why:** The two `Pressable`s in `styles.actions` are mounted whether or not the row is open. They sit *behind* the card visually, but nothing hides them from assistive tech: iOS VoiceOver and Android TalkBack can focus "Pin" and "Delete" on a row nobody swiped, duplicating the card's own `accessibilityActions` in a confusing order; on web they are focusable DOM buttons behind the card.

### Task 1: Hide the action layer until the row is open

**Files:**
- Modify: `src/components/gallery/project-row.tsx` (the `openSide`-derived render, lines ~153–442)

**Interfaces:**
- Consumes: `openSide: SwipeSide` (already a prop).
- Produces: nothing new — the action container and its two `Pressable`s gain gate props keyed on `open`. Phase 3 will move the `Pressable`s into `RowAction` and thread `focusable` through; the container props added here stay.

- [ ] **Step 1: Derive the open flag**

In `ProjectRow`, immediately after `const isRow = layout === 'row';` add:

```tsx
  /** The action layer is only live while the row is open. Closed, it is inert. */
  const open = openSide !== null;
```

- [ ] **Step 2: Gate the container**

Replace the actions wrapper:

```tsx
      <View style={[styles.actions, rowStyle(isRTL)]}>
```

with:

```tsx
      <View
        style={[styles.actions, rowStyle(isRTL)]}
        // The actions live *behind* the card whether or not the row is open.
        // Closed, they must be unreachable: a screen reader would otherwise land
        // on "Pin"/"Delete" for a row nobody swiped, duplicating the card's own
        // custom actions, and on web they would sit in the tab order behind the
        // card. `accessibilityElementsHidden` covers iOS, the Android analogue is
        // `importantForAccessibility`, and `pointerEvents` stops stray hits.
        pointerEvents={open ? 'auto' : 'none'}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      >
```

- [ ] **Step 3: Remove the now-unreachable actions from the keyboard**

On **both** `Pressable`s inside that wrapper (the pin one and the delete one), add:

```tsx
            focusable={open}
```

Place it next to `accessibilityRole="button"`. `aria-hidden` (what RN Web maps `accessibilityElementsHidden` onto) does not by itself remove an element from the tab order, so without this a web keyboard user still lands on a hidden, unlabelled-in-context button.

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no output, exit 0.

Run: `npx eslint src --cache --cache-location .eslintcache`
Expected: no output, exit 0. (If `focusable` / `importantForAccessibility` are untyped by the installed RN, tsc reports it here — do not widen the prop with `as any`; use the RN `ViewProps` types as-is.)

- [ ] **Step 5: Manual a11y verification (Review Focus #1 and #2)**

On a simulator/device with a screen reader enabled:

1. Focus the card of a **closed** row and swipe through its elements once. Expected: it announces the card label and its three custom actions only — no standalone "Pin" or "Delete".
2. Swipe the row open, then swipe through again. Expected: "Pin" (or "Unpin") and "Delete" are now reachable.
3. Open a row, then delete it and tap **Undo** in the snackbar. Expected: the restored row renders closed; focus does not jump to a hidden action.

On web (`yarn web`), press `Tab` repeatedly from the list top. Expected: focus moves card → card, never to an action behind a closed card; opening a row with the mouse does expose them.

- [ ] **Step 6: Commit**

```bash
git add src/components/gallery/project-row.tsx
git commit -m "fix(gallery): hide swipe actions from assistive tech until revealed"
```

---

# Phase 2 — Extract and verify the swipe geometry

**Why:** The commit decision, the rubber-band and the momentum projection are the row's most load-bearing logic and its least visible: they live as magic numbers (`0.15`, `ACTION_W * 0.15`, `COMMIT_RATIO`) inside the gesture callback. Lifting them into an import-free module lets `scripts/check-swipe.mjs` (transpile + evaluate, exactly like `check-handles.mjs`) pin the invariants, and gives every constant a name and a reason.

### Task 2: Create the pure swipe module

**Files:**
- Create: `src/components/gallery/swipe.ts`

**Interfaces:**
- Consumes: nothing (no imports).
- Produces: the full interface listed at the top of this plan. Task 3 and Task 4 rely on every name and signature there. `SwipeSide` is re-exported from `project-row.tsx` so `gallery.tsx`'s `import { type SwipeSide } from '@/components/gallery/project-row'` keeps working.

- [ ] **Step 1: Write the module**

Create `src/components/gallery/swipe.ts`:

```ts
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
```

- [ ] **Step 2: Rewire `project-row.tsx` to consume the module**

a. Delete the local constants (the `ACTION_W` … `FLICK_FLOOR` block, lines ~30–64) and the `SwipeSide` type declaration (line ~79). Import instead:

```tsx
import {
  ACTION_W,
  PANEL_W,
  clampSettleVelocity,
  resolveSwipeSide,
  rubberband,
  settleTarget,
  type SwipeSide,
} from './swipe';

export type { SwipeSide } from './swipe';
```

b. Replace the `targetFor` callback (lines ~160–164) with the imported helper. Delete:

```tsx
  const targetFor = useCallback(
    (side: SwipeSide) =>
      side === null ? 0 : (side === 'trailing' ? -1 : 1) * ACTION_W * dir,
    [dir],
  );
```

and change the effect body to:

```tsx
  // Follow the parent's state (another row opened, or this one was closed).
  useEffect(() => {
    const target = settleTarget(openSide, dir);
    if (x.value === target) {
      return;
    }
    // …unchanged…
    x.value = reduceMotion
      ? withTiming(target, { duration: motion.fast })
      : withSpring(target, {
          ...(openSide === null ? REST_SPRING : LATCH_SPRING),
          velocity: 0,
        });
  }, [openSide, dir, reduceMotion, x]);
```

c. Replace the `.onUpdate` body's inline rubber-band with the helper:

```tsx
    .onUpdate((e) => {
      // eslint-disable-next-line react-hooks/immutability
      x.value = rubberband(startX.value + e.translationX);
    })
```

d. Replace the `.onEnd` decision with the helper:

```tsx
    .onEnd((e) => {
      const side = resolveSwipeSide({
        startX: startX.value,
        translationX: e.translationX,
        velocityX: e.velocityX,
        dir,
      });
      const target = settleTarget(side, dir);
      // Hand the release velocity to the settling spring so a flick carries
      // through instead of restarting from a standstill (onboarding/step-pager.tsx),
      // and settle with the preset the destination calls for: the latch bounces,
      // the return snaps.
      // eslint-disable-next-line react-hooks/immutability
      x.value = reduceMotion
        ? withTiming(target, { duration: motion.fast })
        : withSpring(target, {
            ...(side === null ? REST_SPRING : LATCH_SPRING),
            velocity: clampSettleVelocity(e.velocityX),
          });
      runOnJS(onOpenChange)(side);
    });
```

e. `useCallback` is still used elsewhere in the file, so leave the import. Remove `PANEL_W`'s old local comment block; the JSDoc now lives in `swipe.ts`.

- [ ] **Step 3: Verify the extraction is behavior-preserving**

Run: `npx tsc --noEmit`
Expected: no output, exit 0.

Run: `npx eslint src --cache --cache-location .eslintcache`
Expected: no output, exit 0.

Walk the diff for shapes: `resolveSwipeSide` must produce the same three-way result the old inline ternary did, and `settleTarget(side, dir)` must equal the old `(side === 'trailing' ? -1 : 1) * ACTION_W * dir` for all three sides.

Finally, run the app and swipe a row open and closed once. Expected: the reveal animates exactly as before and no red-screen "non-worklet function on the UI thread" error appears — that error is the failure mode a missing `'worklet'` directive produces, and it only shows on device, never in tsc or eslint.

- [ ] **Step 4: Commit**

```bash
git add src/components/gallery/swipe.ts src/components/gallery/project-row.tsx
git commit -m "refactor(gallery): lift swipe geometry into a pure module"
```

### Task 3: Pin the geometry with a standalone check

**Files:**
- Create: `scripts/check-swipe.mjs`
- Modify: `scripts/verify.mjs` (the `TASKS` array, and the header's "five")
- Modify: `AGENTS.md` (the "all five checks" lines and the per-script list)

**Interfaces:**
- Consumes: every export of `src/components/gallery/swipe.ts` (Task 2).
- Produces: `node scripts/check-swipe.mjs`, exit 0 on pass / 1 on fail, registered in `verify.mjs` under id `swipe`.

- [ ] **Step 1: Write the failing check**

Create `scripts/check-swipe.mjs`. Model it on `scripts/check-handles.mjs` — same transpile, same `check`/`ok`/`section` helpers:

```js
/**
 * Standalone verification for the gallery row's swipe geometry.
 *
 * The repo has no test runner, so this transpiles `src/components/gallery/swipe.ts`
 * in memory with the installed TypeScript and pins the invariants the reveal
 * depends on. Like the other checks it needs no tsconfig, no `@/` resolution and
 * writes nothing — which is why `swipe.ts` must declare no imports.
 *
 * The bug this locks down: the reveal's reach used to be a set of unnamed
 * literals inside a gesture callback. Stated here in dp, the assertions fail if
 * a flick can outrun the panel (a page-background sliver opens between card and
 * panel), if the rubber-band stops being monotonic or asymmetric, if the commit
 * threshold can be crossed with no real travel, or if RTL flips an intent.
 *
 * Run: node scripts/check-swipe.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  join(here, '..', 'src', 'components', 'gallery', 'swipe.ts'),
  'utf8',
);

const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});

const moduleShim = { exports: {} };
new Function('exports', 'module', outputText)(moduleShim.exports, moduleShim);
const {
  ACTION_W,
  ELASTIC_TRAVEL,
  PANEL_W,
  COMMIT_RATIO,
  FLICK_FLOOR,
  MAX_SETTLE_VELOCITY,
  PROJECTION_SECONDS,
  clampSettleVelocity,
  projectPosition,
  resolveSwipeSide,
  rubberband,
  settleTarget,
} = moduleShim.exports;

let failures = 0;

function check(name, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (ok) {
    console.log(`  PASS  ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL  ${name}`);
  console.log(`        expected ${JSON.stringify(expected)}`);
  console.log(`        got      ${JSON.stringify(got)}`);
}

function ok(name, condition) {
  check(name, condition, true);
}

function section(title) {
  console.log(`\n${title}`);
}

const EPS = 1e-6;
const near = (a, b) => Math.abs(a - b) < EPS;

const LTR = 1;
const RTL = -1;

// ---------------------------------------------------------------------------

section('the panel is exactly the reveal plus its give');

check('PANEL_W adds the give to the reveal', PANEL_W, ACTION_W + ELASTIC_TRAVEL);

for (const dir of [LTR, RTL]) {
  for (const side of ['leading', 'trailing']) {
    ok(
      `a full ${side} reveal is covered by the panel (dir ${dir})`,
      Math.abs(settleTarget(side, dir)) <= PANEL_W,
    );
  }
}

// The widest the card can be pushed: a max-velocity latch overshoots past
// ACTION_W, and the rubber-band pushes further still — both must stay inside
// PANEL_W or a sliver of page background shows between card and panel.
const MAX_OVERSHOOT = 0.0288 * MAX_SETTLE_VELOCITY;
ok(
  `the worst-case latch overshoot (${MAX_OVERSHOOT.toFixed(1)}dp) fits the give`,
  ACTION_W + MAX_OVERSHOOT <= PANEL_W,
);
ok(
  'the rubber-band asymptote is the panel width, not past it',
  rubberband(1e6) <= PANEL_W + EPS && rubberband(1e6) > PANEL_W - 1,
);

// ---------------------------------------------------------------------------

section('the rubber-band is identity inside the reveal, elastic outside');

check('at rest nothing moves', rubberband(0), 0);
check('inside the reveal the card tracks 1:1', rubberband(ACTION_W * 0.5), ACTION_W * 0.5);
check('exactly at the reveal it still tracks', rubberband(ACTION_W), ACTION_W);

ok('past the reveal it gives, never stops dead', rubberband(ACTION_W + 1) > ACTION_W);
ok(
  'past the reveal it never exceeds the panel',
  rubberband(ACTION_W + 1) < PANEL_W,
);

let monotonic = true;
let previous = rubberband(ACTION_W);
for (let over = 1; over <= 400; over += 7) {
  const value = rubberband(ACTION_W + over);
  if (value < previous) monotonic = false;
  previous = value;
}
ok('the resistance is monotonic — dragging further never pulls back', monotonic);

ok('the give is symmetric', near(rubberband(-(ACTION_W + 30)), -rubberband(ACTION_W + 30)));

// ---------------------------------------------------------------------------

section('RTL mirrors the intent, not the action');

check('LTR leading sits to the right', settleTarget('leading', LTR), ACTION_W);
check('LTR trailing sits to the left', settleTarget('trailing', LTR), -ACTION_W);
check('RTL leading sits to the left', settleTarget('leading', RTL), -ACTION_W);
check('RTL trailing sits to the right', settleTarget('trailing', RTL), ACTION_W);
check('rest is zero in both directions', settleTarget(null, RTL), 0);

// ---------------------------------------------------------------------------

section('momentum projection is the documented window');

check('projection adds v · PROJECTION_SECONDS', projectPosition(0, 0, 100), 15);
check('projection includes the travel so far', projectPosition(20, 30, 0), 50);

// ---------------------------------------------------------------------------

section('the commit decision needs travel AND a projected threshold');

const travel = (fraction) => ACTION_W * fraction;

check(
  'below the flick floor, a huge velocity cannot latch',
  resolveSwipeSide({
    startX: 0,
    translationX: FLICK_FLOOR - 1,
    velocityX: 5000,
    dir: LTR,
  }),
  null,
);
check(
  'a still release past the ratio latches leading',
  resolveSwipeSide({
    startX: 0,
    translationX: travel(COMMIT_RATIO + 0.01),
    velocityX: 0,
    dir: LTR,
  }),
  'leading',
);
check(
  'a still release short of the ratio returns',
  resolveSwipeSide({
    startX: 0,
    translationX: travel(COMMIT_RATIO - 0.01),
    velocityX: 0,
    dir: LTR,
  }),
  null,
);
check(
  'the threshold itself does not latch (strict >)',
  resolveSwipeSide({
    startX: 0,
    translationX: travel(COMMIT_RATIO),
    velocityX: 0,
    dir: LTR,
  }),
  null,
);
check(
  'a real flick past the floor latches on velocity alone',
  resolveSwipeSide({
    startX: 0,
    translationX: travel(0.2),
    velocityX: 200,
    dir: LTR,
  }),
  'leading',
);
check(
  'RTL flips an identical rightward gesture to trailing',
  resolveSwipeSide({
    startX: 0,
    translationX: travel(0.5),
    velocityX: 0,
    dir: RTL,
  }),
  'trailing',
);
check(
  'RTL flips an identical leftward gesture to leading',
  resolveSwipeSide({
    startX: 0,
    translationX: -travel(0.5),
    velocityX: 0,
    dir: RTL,
  }),
  'leading',
);
check(
  'a no-move release from an open row returns to rest',
  resolveSwipeSide({
    startX: settleTarget('leading', LTR),
    translationX: 0,
    velocityX: 0,
    dir: LTR,
  }),
  null,
);

// ---------------------------------------------------------------------------

section('the settle velocity is clamped into what the panel can absorb');

check('a fast positive flick is clamped', clampSettleVelocity(5000), MAX_SETTLE_VELOCITY);
check('a fast negative flick is clamped', clampSettleVelocity(-5000), -MAX_SETTLE_VELOCITY);
check('a gentle flick passes through', clampSettleVelocity(120), 120);
check('zero stays zero', clampSettleVelocity(0), 0);

// ---------------------------------------------------------------------------

section('no import can smuggle state into this module');

ok(
  'swipe.ts declares no imports (the check transpiles it standalone)',
  !/^\s*import\b/m.test(source),
);
// Five helpers are called from gesture worklets. Strip the directive and the
// gesture throws on the UI thread at runtime — this repo has no device test, so
// the source is the only place to pin it.
ok(
  'the worklet-called helpers carry the worklet directive',
  (source.match(/'worklet'|"worklet"/g) ?? []).length >= 5,
);

console.log(
  failures === 0
    ? '\nAll swipe checks passed.'
    : `\n${failures} swipe check(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it — it must fail before the module exists**

If you wrote Task 2 first this passes; that is the point of the check. To see it
fail first, run it once at the start of Task 2 (before creating `swipe.ts`):

Run: `node scripts/check-swipe.mjs`
Expected before Task 2: `ENOENT: no such file or directory … swipe.ts`, exit 1.
Expected now: all sections `PASS`, `All swipe checks passed.`, exit 0.

- [ ] **Step 3: Register the check and fix the count**

In `scripts/verify.mjs`, add to `TASKS` after the `handles` entry:

```js
  { id: 'swipe', command: [join(here, 'check-swipe.mjs')] },
```

and change the header's `the five \`check-*\` scripts` to `the six \`check-*\` scripts`.

In `AGENTS.md`, change "runs the typecheck, the lint and all five checks **in parallel**" to "all six checks", and add to the per-script list, after the `check-handles.mjs` line:

```bash
node scripts/check-swipe.mjs    # gallery row swipe geometry + commit decision
```

Do **not** touch `docs/index.md` §4. It frames its table as editor *contracts* that own a script, and the swipe check has no contract document; `AGENTS.md` is the authoritative list of checks.

- [ ] **Step 4: Run the full suite**

Run: `node scripts/verify.mjs`
Expected: `8/8 passed` (typecheck, lint, clusters, groups, handles, shortcuts, help, swipe). Every task prints `PASS`.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-swipe.mjs scripts/verify.mjs AGENTS.md
git commit -m "test(gallery): pin swipe geometry with check-swipe"
```

---

# Phase 3 — Instant press feedback on the revealed actions

**Why:** The two actions respond only on release. Principle 1 of the review — "respond on pointer-down" — is only half-met: the drag tracks instantly, but the action you are about to commit to (including the destructive one) shows nothing until the finger lifts. The kit already solves this: `usePressFeedback` writes `pressed` and `scale` shared values on touch-down and springs back on release, and `Card`/`IconButton` use it exactly this way. Extracting a `RowAction` also removes the duplicated markup and the per-action styles from an already-long `project-row.tsx`.

### Task 4: Extract `RowAction` with shared press feedback

**Files:**
- Create: `src/components/gallery/row-action.tsx`
- Modify: `src/components/gallery/project-row.tsx` (replace the two inline `Pressable`s; delete the `action` / `actionLabel` styles)

**Interfaces:**
- Consumes: `ACTION_W` from `./swipe` (Task 2); `AnimatedPressable`, `Icon`, `IconName`, `IconProps` from `@/components/ui`; `usePressFeedback` from `@/hooks/use-press-feedback`; `fontRoles`, `spacing`, `typeScale` from `@/theme`; `useT` from `@/i18n`.
- Produces: `RowAction({ icon, label, onPress, color, weight, focusable })` and its `RowActionProps`.

- [ ] **Step 1: Write the component**

Create `src/components/gallery/row-action.tsx`:

```tsx
import { StyleSheet, Text } from 'react-native';
import { useAnimatedStyle } from 'react-native-reanimated';

import {
  AnimatedPressable,
  Icon,
  type IconName,
  type IconProps,
} from '@/components/ui';
import { usePressFeedback } from '@/hooks/use-press-feedback';
import { useT } from '@/i18n';
import { fontRoles, spacing, typeScale } from '@/theme';

import { ACTION_W } from './swipe';

export interface RowActionProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** Icon + label colour, chosen by the parent that owns the row's state. */
  color: string;
  /** `fill` marks a pinned row; `regular` is the default. */
  weight?: IconProps['weight'];
  /** Reachable by screen reader/keyboard only while its row is open. */
  focusable: boolean;
}

/**
 * One swipe action behind a gallery row: a glyph over its label.
 *
 * Press feedback is the shared `usePressFeedback` behaviour, matching `Card` and
 * `IconButton`: the press lands on touch-down (opacity + scale), the release
 * settles by spring. That is what makes the red delete panel read as a physical
 * control you have already pressed, rather than something that only reacts once
 * the finger has gone. Reduce motion keeps the opacity change and drops the
 * scale — the feedback stays, the vestibular motion does not.
 */
export function RowAction({
  icon,
  label,
  onPress,
  color,
  weight = 'regular',
  focusable,
}: RowActionProps) {
  const { language } = useT();
  const fonts = fontRoles[language];
  const press = usePressFeedback();
  const animStyle = useAnimatedStyle(() => ({
    opacity: press.pressed.value ? 0.7 : 1,
    transform: [{ scale: press.scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      focusable={focusable}
      accessibilityRole="button"
      accessibilityLabel={label}
      // The animated style reaches the Pressable directly — see `pressable.tsx`
      // for why a `({ pressed }) => …` style function never updates.
      style={[styles.action, animStyle]}
    >
      <Icon name={icon} size={18} color={color} weight={weight} />
      <Text
        numberOfLines={1}
        style={[styles.label, { color, fontFamily: fonts.ui }]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: ACTION_W,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  label: {
    fontSize: typeScale.micro.size,
  },
});
```

- [ ] **Step 2: Replace the inline actions in `project-row.tsx`**

Add the import:

```tsx
import { RowAction } from './row-action';
```

Replace the pin `Pressable` (inside the first `styles.panel`) with:

```tsx
          <RowAction
            icon="pin"
            label={pinned ? t.gallery.unpin : t.gallery.pin}
            onPress={onTogglePin}
            color={pinned ? c.accentText : c.muted}
            weight={pinned ? 'fill' : 'regular'}
            focusable={open}
          />
```

Replace the delete `Pressable` inside the `styles.panelEnd` panel with:

```tsx
          <RowAction
            icon="trash"
            label={t.common.delete}
            onPress={onDelete}
            color={c.onInk}
            focusable={open}
          />
```

Delete the now-unused `styles.action` and `styles.actionLabel` entries and the `Pressable` / `Text` imports **only if nothing else in the file still uses them** — `Text` is still used by the card, and `Pressable` is not used elsewhere, so remove `Pressable` from the `react-native` import but keep `Text`. Also remove `ACTION_W` from the `'./swipe'` import: it was only referenced by `styles.action`, which just moved into `RowAction`. The other four helpers stay in use.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no output, exit 0. If `IconProps` is not exported from `@/components/ui`, it is (see `index.ts` line 10); do not inline the union.

Run: `npx eslint src --cache --cache-location .eslintcache`
Expected: no output, exit 0. If the Reanimated shared-value reads in `useAnimatedStyle` trip `react-hooks/immutability`, match the pattern already in `card.tsx` / `icon-button.tsx` — those read `press.pressed.value` the same way with no suppression.

- [ ] **Step 4: Manual verification (Review Focus #3 and #4)**

Native, swipe a row open, then:

1. Press and hold **Pin**. Expected: the glyph + label dim and scale down the instant the finger lands, and spring back on release — a visible discrete response, not a delayed one.
2. Press and hold **Delete**. Expected: the same instant response on the red panel; the panel background itself does not move.
3. Enable **Reduce Motion**, repeat both. Expected: the opacity dim is still there; there is no scale.
4. Do a very fast flick on a row and watch the reveal edge. Expected: the card overshoots the action and settles back; at no frame does page background show between card and panel (Review Focus #4).

- [ ] **Step 5: Commit**

```bash
git add src/components/gallery/row-action.tsx src/components/gallery/project-row.tsx
git commit -m "feat(gallery): instant press feedback on revealed row actions"
```

---

# Phase 4 — Final whole-branch verification

### Task 5: Verify the whole change set

**Files:** none.

- [ ] **Step 1: Full suite on the branch**

Run: `node scripts/verify.mjs`
Expected: every task `PASS`, final line `N/N passed` with N = typecheck, lint, clusters, groups, handles, shortcuts, help, swipe.

- [ ] **Step 2: Formatting on the files touched**

Run: `yarn format:fix` (or `npx prettier --write` scoped to the four changed files)
Expected: no reformat needed, or only the files touched.

- [ ] **Step 3: Cross-check the Review Focus list**

Confirm each of the five items was exercised in the task that owns it: #1 (Task 1 Step 5, item 3 — delete then Undo), #2 (Task 1 Step 5, items 1–2), #3 (Task 4 Step 4, item 3), #4 (Task 3 `MAX_OVERSHOOT <= PANEL_W` assertion plus Task 4 Step 4 item 4), #5 (Task 3 threshold/floor assertions). If any is unexercised, add the test before finishing.

- [ ] **Step 4: Confirm no behavior drift**

Skim `git diff main -- src/components/gallery/project-row.tsx` and confirm the only functional changes are the gate props, the `RowAction` swap, and the helper calls — the gesture recognizer config, panel layout, and parent effect are otherwise untouched.
