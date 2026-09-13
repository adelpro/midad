import { Platform } from "react-native";

import * as Haptics from "expo-haptics";

/**
 * Haptic feedback, per DESIGN.md §6 — "haptics on meaningful moments only".
 *
 * Three semantic verbs rather than raw API calls, so call sites express intent
 * and the platform mapping stays in one place.
 *
 * **Android uses `performAndroidHapticsAsync`, not `impactAsync`.** Expo's own
 * docs are explicit that Android's `Vibrator` API (which `impactAsync`/
 * `notificationAsync` use) "is not recommended for implementing haptics
 * feedback" and that the semantic constants are the better match for iOS-style
 * feedback. It also avoids the `VIBRATE` permission path.
 *
 * Web goes through the Web Vibration API, which is a silent no-op on desktop
 * browsers — exactly the behaviour DESIGN.md asks for, with no `Platform` guard.
 *
 * These all return promises and are always fire-and-forget: a device that
 * cannot produce haptics (Low Power Mode, no Taptic Engine, unsupported
 * browser, denied vibration permission) must never surface an error.
 */

/** Swallow rejections — feedback must never become a UI failure. */
function fire(promise: Promise<void>): void {
  promise.catch(() => undefined);
}

/** A discrete selection changed: a tool, a pin, a pager step. */
export function hapticTick(): void {
  if (Platform.OS === "android") {
    fire(
      Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick),
    );
    return;
  }
  fire(Haptics.selectionAsync());
}

/** The user is about to destroy something recoverable. */
export function hapticDelete(): void {
  if (Platform.OS === "android") {
    fire(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject));
    return;
  }
  fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

/** Work landed: a save or an export completed. */
export function hapticSuccess(): void {
  if (Platform.OS === "android") {
    fire(Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm));
    return;
  }
  fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}
