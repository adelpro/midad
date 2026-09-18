import { Slider as ExpoSlider, Host } from '@expo/ui';
import { useCallback, useEffect, useInsertionEffect, useRef } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type SliderScale = 'linear' | 'log';

export interface SliderProps {
  value: number;
  min: number;
  /** Must be > 0 when `scale` is `"log"` — a geometric range needs a positive floor. */
  max: number;
  /** Value quantisation. Default `1`. */
  step?: number;
  /**
   * `"log"` maps equal travel to equal *relative* change, so doubling a small
   * size costs the same drag as doubling a large one. That is the honest feel
   * for type sizes; `"linear"` crowds the small end of a wide range.
   */
  scale?: SliderScale;
  /** Fires continuously while dragging, with the snapped value. */
  onChange?: (value: number) => void;
  /** Fires once as an interaction opens, before the first `onChange`. */
  onSlidingStart?: () => void;
  /**
   * Fires once as the interaction settles, with the final snapped value — a
   * short beat *after* the last change, not on finger-up (the platform sliders
   * report no release event; see the session note on the component).
   */
  onSlidingComplete?: (value: number) => void;
  /** Mirror the travel direction so the track starts on the right. */
  rtl?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Value → track position (0–1). */
function valueToPosition(
  value: number,
  min: number,
  max: number,
  scale: SliderScale,
): number {
  const t =
    scale === 'log'
      ? Math.log(value / min) / Math.log(max / min)
      : (value - min) / (max - min);
  return Math.min(1, Math.max(0, t));
}

/**
 * Track position (0–1) → snapped value.
 *
 * Snaps before clamping: clamping first can leave an off-grid value at the ends.
 */
function positionToValue(
  position: number,
  min: number,
  max: number,
  scale: SliderScale,
  step: number,
): number {
  const raw =
    scale === 'log'
      ? min * Math.pow(max / min, position)
      : min + position * (max - min);
  const snapped = Math.round(raw / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

/**
 * A quiet gap this long ends a drag session.
 *
 * Long enough to survive the frame-by-frame gaps inside one gesture, short
 * enough that the settle lands as the finger stops.
 */
const SESSION_IDLE_MS = 300;

const WEB_STYLE_ID = 'midad-slider-web-css';

/**
 * Corrections for `@expo/ui`'s web slider, which is a real `<input type="range">`
 * styled by the library. Two gaps, both measured in a browser:
 *
 * 1. **No width.** The library styles everything but the box, so the input sits
 *    at the UA's ~129px default instead of filling its row — and at 22px tall it
 *    is under the 44pt target DESIGN.md §8 requires. The rail is still 4px; the
 *    box is what grew.
 * 2. **The RTL progress gradient.** The library paints progress with
 *    `linear-gradient(to right, …)`, which is *physical*, while a mirrored
 *    `<input type="range">` measures its value from the right. Chrome mirrors the
 *    value mapping but not the track's painting — measured: a click 25% from the
 *    left lands on 76.5 — so in Arabic the fill grew from the opposite edge to
 *    the thumb. Reversing the gradient under `dir="rtl"` puts it back under the
 *    thumb. Firefox is untouched: it paints progress with `::-moz-range-progress`,
 *    which the browser mirrors itself.
 *
 * Specificity, not load order, is what makes these win: `[data-expo-ui-slider]`
 * plus `[type="range"]` outranks the single class the library emits, so this does
 * not care whether it is inserted before or after their stylesheet.
 */
const WEB_CSS = `
[type="range"][data-expo-ui-slider] {
  width: 100%;
  height: 44px;
}

[dir="rtl"] [type="range"][data-expo-ui-slider]::-webkit-slider-runnable-track {
  background: linear-gradient(
    to left,
    var(--_track-fill) 0 var(--_pct),
    var(--_track-bg) var(--_pct) 100%
  );
}
`;

/** Injects {@link WEB_CSS} once per document. Web only — a no-op elsewhere. */
function useWebSliderFixes() {
  useInsertionEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    if (document.getElementById(WEB_STYLE_ID)) {
      return;
    }
    const style = document.createElement('style');
    style.id = WEB_STYLE_ID;
    style.textContent = WEB_CSS;
    document.head.appendChild(style);
  }, []);
}

/**
 * Horizontal value slider, on `@expo/ui`'s universal `Slider` — a SwiftUI
 * `Slider` on iOS, a Material 3 `Slider` on Android and a real
 * `<input type="range">` on web, so the thumb physics, keyboard behaviour and
 * assistive-technology support are the platform's rather than ours.
 *
 * Two things this wrapper owns, because the platform control does not:
 *
 * **The scale.** The library's track is linear in value, so `scale="log"` is
 * expressed as a position↔value mapping instead: the control runs over 0–1 and
 * the value is snapped here. (A value-space step cannot be expressed as a
 * position-space `step`, which is why the log path passes none.)
 *
 * **The drag session.** The editor brackets a gesture — it snapshots on
 * `onSlidingStart` and applies every live update with `onChange`, so one drag
 * undoes as one step (see `setFontSize` / `beginFontSizeDrag`). The platform
 * sliders only report values, so the bracket is derived: the first change opens
 * the session, a short quiet gap closes it. That holds on every platform,
 * including a keyboard-driven change on web. The cost is that
 * `onSlidingComplete` lands `SESSION_IDLE_MS` after the last change rather than
 * at finger-up.
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  scale = 'linear',
  onChange,
  onSlidingStart,
  onSlidingComplete,
  rtl = false,
  disabled = false,
  accessibilityLabel,
  style,
}: SliderProps) {
  const { colors: c, isDark } = useTheme();
  useWebSliderFixes();

  const isLog = scale === 'log';
  /** What the control itself is driven with — its own units, always linear. */
  const position = isLog ? valueToPosition(value, min, max, scale) : value;

  const sessionOpen = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(value);

  const closeSession = useCallback(() => {
    idleTimer.current = null;
    sessionOpen.current = false;
    onSlidingComplete?.(latest.current);
  }, [onSlidingComplete]);

  const handleValueChange = useCallback(
    (raw: number) => {
      const next = isLog
        ? positionToValue(raw, min, max, scale, step)
        : Math.min(max, Math.max(min, Math.round(raw / step) * step));

      latest.current = next;
      if (!sessionOpen.current) {
        sessionOpen.current = true;
        onSlidingStart?.();
      }
      onChange?.(next);

      if (idleTimer.current) {
        clearTimeout(idleTimer.current);
      }
      idleTimer.current = setTimeout(closeSession, SESSION_IDLE_MS);
    },
    [isLog, min, max, scale, step, onChange, onSlidingStart, closeSession],
  );

  // A panel that unmounts mid-drag still owes its settle.
  useEffect(() => {
    return () => {
      if (idleTimer.current) {
        clearTimeout(idleTimer.current);
        idleTimer.current = null;
      }
    };
  }, []);

  return (
    <Host
      // Pinned rather than inherited: the host also sets the direction for the
      // native control, and this is the one place that knows the intent.
      layoutDirection={rtl ? 'rightToLeft' : 'leftToRight'}
      seedColor={c.accent}
      colorScheme={isDark ? 'dark' : 'light'}
      style={style}
      // RN maps `aria-label` onto `accessibilityLabel` natively. On web it lands
      // on the host element rather than the range input, which already carries
      // its own slider role and value.
      aria-label={accessibilityLabel}
    >
      <ExpoSlider
        value={position}
        onValueChange={handleValueChange}
        min={isLog ? 0 : min}
        max={isLog ? 1 : max}
        step={isLog ? undefined : step}
        disabled={disabled}
      />
    </Host>
  );
}
