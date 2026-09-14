# Spec amendment — haptics + motion completion

Date: 2026-09-13
Status: implemented

> DESIGN.md §7 requires a spec amendment for any new dependency, and names
> `.artifacts/00-design-direction.md` as the home for it. That file does not
> exist; the actual convention in this repo is dated files under
> `.artifacts/specs/`, so the amendment lives here to match what is really
> there. If `00-design-direction.md` is ever created, fold this into it.

## 1. New dependency: `expo-haptics`

DESIGN.md §6 already specified haptics ("tool tick, save success, delete
warning") but the package was never installed — the guidance had no
implementation. This adds it at the SDK-matched version:

    npx expo install expo-haptics   # → expo-haptics@~57.0.3

It is a **native module**: Android/iOS require a rebuild (`npx expo run:android`
/ `run:ios`). Android needs no manual permission — `VIBRATE` is added by the
library's own manifest merge.

### API mapping

Three semantic verbs in `src/haptics.ts` rather than raw calls at call sites:

| Verb                            | iOS / Web                    | Android                                    |
| ------------------------------- | ---------------------------- | ------------------------------------------ |
| `hapticTick()` — a detent       | `selectionAsync()`           | `performAndroidHapticsAsync(Segment_Tick)` |
| `hapticDelete()` — destruction  | `notificationAsync(Warning)` | `performAndroidHapticsAsync(Reject)`       |
| `hapticSuccess()` — work landed | `notificationAsync(Success)` | `performAndroidHapticsAsync(Confirm)`      |

Android deliberately does **not** use `impactAsync`/`notificationAsync`: Expo's
own docs state Android's `Vibrator` API "is not recommended for implementing
haptics feedback" and direct callers to the semantic constants instead.

Web routes to the Web Vibration API, which is a silent no-op on desktop
browsers — DESIGN.md's "web = silent no-op" falls out for free, so no `Platform`
guard is needed there. All three are fire-and-forget and swallow rejections: a
device that cannot produce haptics (Low Power Mode, no Taptic Engine,
unsupported browser) must never surface an error.

### Where it fires

Only at the moments DESIGN.md §6 names, plus the moments this feature introduced:

- **Gallery** — pin/unpin and undo (`tick`), delete (`delete`), and the swipe
  latching open (`tick`, the reveal detent).
- **Editor** — tool selection (`tick`), delete objects (`delete`), save
  (`success`, which also covers the save that precedes every export).

Deliberately **not** wired: auto-save. It fires on a timer, so a haptic there
would buzz every 30s while the user is simply drawing. DESIGN.md's "save
success" is satisfied by the explicit save/export path.

## 2. Motion: springs everywhere interactive

DESIGN.md §6 says "reanimated springs only" and §8 bans "linear easing or
duration-based tweens on interactive elements", but `springs` did not exist in
`src/theme/tokens.ts` and `step-pager.tsx` settled with `withTiming`. Both are
now fixed:

- `springs` added to `tokens.ts` with the three presets §6 documents
  (`ui` 1.0/260, `momentum` 0.8/320, `sheet` 0.85/300).
- `step-pager.tsx` settles by `springs.ui` for CTA-driven jumps, and by
  `springs.momentum` **with the release velocity handed to the spring**
  (`velocity: e.velocityX`) for gesture release — §6's "velocity handoff",
  which a duration tween cannot express.
- The new gallery swipe row uses `springs.momentum`.

Two `withTiming` uses remain, both intentionally:

- `skeleton.tsx` — an ambient `withRepeat` pulse. Not interactive, and a spring
  cannot express an infinite loop.
- `snackbar.tsx` / `project-row.tsx` — the **Reduce Motion** path. Reduced
  motion gets a cross-fade, never a spring.

`gallery-header.tsx` is scroll-driven (`interpolate(scrollY)`), so it must stay
a direct mapping and must not be springed.

## 3. Pin reorder animation

FlashList v2 removed the `itemLayoutAnimation` prop. Its documented approach is
RN's `LayoutAnimation`, which requires `prepareForLayoutAnimationRender()` on the
list ref first (plus `keyExtractor`, already present). Implemented in
`gallery.tsx` with `update: { type: spring, springDamping: springs.sheet.damping }`
to stay inside the spring vocabulary.

Known limits, accepted:

- FlashList's docs call Android's `LayoutAnimation` "experimental"; rows may
  jump there.
- `LayoutAnimation` is a no-op on react-native-web; rows jump there too.
- `UIManager.setLayoutAnimationEnabledExperimental` is **not** called — it is a
  no-op under the New Architecture this app runs on.
