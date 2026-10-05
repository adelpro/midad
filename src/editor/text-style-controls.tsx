import { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';

import { Icon, IconButton, Slider } from '@/components/ui';
import { hapticTick } from '@/haptics';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import {
  DEFAULT_LEADING_RATIO,
  fontRoles,
  radius,
  spacing,
  typeScale,
} from '@/theme';

/**
 * Typography controls for the editor's text sheets, split out of
 * `EditorScreen.tsx` because they are self-contained and the screen is already
 * the largest file in the app.
 */

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** Floor for the preview's type size (dp) — keeps the smallest sizes legible. */
const MIN_PREVIEW_PX = 10;
/** Lateral padding inside the preview box (dp). */
const PREVIEW_PAD_X = spacing.md;
/**
 * Vertical padding inside the preview box (dp).
 *
 * The box used to have lateral padding only, which is what clipped tashkeel:
 * with no space reserved above the text, the first line's harakat were the first
 * thing to go.
 */
const PREVIEW_PAD_Y = spacing.md;
/**
 * Room a glyph cluster may reach past its line box, per side, as a fraction of
 * the preview's type size.
 *
 * Arabic harakat sit above the font's nominal ascent and are *not* part of
 * `lineHeight`, so a box that reserves only the line box slices them off at the
 * top edge. 0.2em covers a shadda plus fatha stacked two marks deep, which is
 * the worst case in the calligraphy faces.
 */
const DIACRITIC_HEADROOM = 0.2;
/** Hairline around the preview box (dp) — part of the height budget, not ink. */
const PREVIEW_BORDER = 1;
/**
 * Share of the window height the preview box may occupy.
 *
 * Proportional rather than fixed so a short phone gets a shorter preview instead
 * of a sheet whose top runs off the screen.
 */
const PREVIEW_WINDOW_FRACTION = 0.2;
/** Floor and ceiling for the preview box (dp). */
const PREVIEW_MIN_HEIGHT = 132;
const PREVIEW_MAX_HEIGHT = 200;

export interface NumberStepperProps {
  label: string;
  display: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
}

/**
 * Label + value + −/+ stepper for the numeric typography controls. Bounds come
 * from the caller so each control owns its own limits.
 */
export function NumberStepper({
  label,
  display,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
}: NumberStepperProps) {
  const { colors: c } = useTheme();
  const { language } = useT();
  const font = fontRoles[language].ui;
  return (
    <View style={styles.numberRow}>
      <Text
        style={[styles.numberLabel, { color: c.inkSoft, fontFamily: font }]}
      >
        {label}
      </Text>
      <View style={styles.numberControls}>
        <IconButton
          onPress={onPrev}
          disabled={prevDisabled}
          accessibilityLabel={`${label} −`}
          hint={`${label} −`}
        >
          <Icon name="minus" size={16} />
        </IconButton>
        <Text style={[styles.numberValue, { color: c.ink, fontFamily: font }]}>
          {display}
        </Text>
        <IconButton
          onPress={onNext}
          disabled={nextDisabled}
          accessibilityLabel={`${label} +`}
          hint={`${label} +`}
        >
          <Icon name="plus" size={16} />
        </IconButton>
      </View>
    </View>
  );
}

export interface FontSizeGaugeProps {
  /** Size in canvas design units. */
  value: number;
  min: number;
  max: number;
  /** Fine-step delta for the ± buttons, in design units. */
  step: number;
  onChange: (value: number) => void;
  /**
   * Fires before any value change — on drag activation, and before a ± tap — so
   * a caller that snapshots here gets exactly one history entry per edit.
   */
  onSlidingStart?: () => void;
  onSlidingComplete?: (value: number) => void;
  disabled?: boolean;
}

/**
 * Font size: a coarse gauge with fine ± stepping.
 *
 * Two control rates in one row, on purpose — the slider crosses the whole
 * range in a single gesture, while the steppers land on an exact value. That
 * pairing is why the gauge absorbs the steppers rather than replacing them.
 *
 * The track is **geometric** (`scale="log"`): 12→24 costs the same travel as
 * 300→600, which is the only scale on which a 12–600pt range feels even.
 */
export function FontSizeGauge({
  value,
  min,
  max,
  step,
  onChange,
  onSlidingStart,
  onSlidingComplete,
  disabled,
}: FontSizeGaugeProps) {
  const { t, isRTL } = useT();
  const clamped = clamp(value, min, max);

  const nudge = useCallback(
    (delta: number) => {
      const next = clamp(clamped + delta, min, max);
      if (next === clamped) {
        return;
      }
      // A step is a one-tap edit, so it announces itself exactly like a drag:
      // that puts the caller's snapshot on the same beat, and keeps "one edit =
      // one undo entry" true whichever control produced the change.
      onSlidingStart?.();
      hapticTick();
      onChange(next);
    },
    [clamped, min, max, onChange, onSlidingStart],
  );

  const settle = useCallback(
    (next: number) => {
      hapticTick();
      onSlidingComplete?.(next);
    },
    [onSlidingComplete],
  );

  return (
    <View style={styles.gauge}>
      <NumberStepper
        label={t.editor.fontSize}
        display={String(Math.round(clamped))}
        onPrev={() => nudge(-step)}
        onNext={() => nudge(step)}
        prevDisabled={disabled || clamped <= min}
        nextDisabled={disabled || clamped >= max}
      />
      <View style={styles.gaugeGap}>
        <Slider
          value={clamped}
          min={min}
          max={max}
          step={step}
          scale="log"
          onChange={onChange}
          onSlidingStart={onSlidingStart}
          onSlidingComplete={settle}
          rtl={isRTL}
          disabled={disabled}
          accessibilityLabel={t.editor.fontSize}
        />
      </View>
    </View>
  );
}

export interface TextPreviewProps {
  /** The draft. Falls back to a muted sample when blank. */
  text: string;
  /** Registered family key, e.g. `Amiri` or `Amiri-Bold`. */
  fontKey: string;
  /** Localized name of the face, shown beside the caption. */
  fontLabel: string;
  /** Size in canvas design units — scaled to the box, never used verbatim. */
  fontSize: number;
  /** Leading in canvas design units. Falls back to the default ratio. */
  lineHeight?: number;
  /** Design-space width of the canvas — the scale reference. */
  canvasWidth: number;
}

/**
 * Mini canvas: the text set in the chosen face at its true relative size.
 *
 * Rendered with a plain RN `<Text>` rather than Skia. The shapes are the same
 * font file and the size is the same *fraction* of the artwork, so the face and
 * the size are honest — but plain text will not match the canvas's HarfBuzz
 * shaping glyph for glyph. That trade buys a preview that costs nothing to
 * re-render on every keystroke, which is what makes it live.
 *
 * The box is sized from a window-relative budget rather than a constant, and the
 * type size it caps is derived from the *ink* that has to fit — the line box
 * plus `DIACRITIC_HEADROOM` either side — so tashkeel is never clipped, whichever
 * face and size is picked.
 */
export function TextPreview({
  text,
  fontKey,
  fontLabel,
  fontSize,
  lineHeight,
  canvasWidth,
}: TextPreviewProps) {
  const { colors: c } = useTheme();
  const { t, language, isRTL } = useT();
  const { height: windowHeight } = useWindowDimensions();
  const font = fontRoles[language].ui;
  /** Measured box width — the other half of the canvas scale reference. */
  const [boxWidth, setBoxWidth] = useState(0);

  const onBoxLayout = useCallback((e: LayoutChangeEvent) => {
    setBoxWidth(e.nativeEvent.layout.width);
  }, []);

  /** Height the box is allowed to occupy, in dp. */
  const budget = clamp(
    Math.round(windowHeight * PREVIEW_WINDOW_FRACTION),
    PREVIEW_MIN_HEIGHT,
    PREVIEW_MAX_HEIGHT,
  );
  /**
   * Height the text may use — the budget less the border and padding.
   *
   * Both the size ceiling and the line count are derived from *this*, which is
   * what makes the headroom guarantee exact: for any line count the cap allows,
   * the centred text block is left at least `headroom` above and below.
   */
  const innerHeight = budget - PREVIEW_BORDER * 2 - PREVIEW_PAD_Y * 2;

  // The same relative size as the canvas: a 96pt title on a 1080-wide artwork
  // covers the same fraction of the preview as it does of the artwork.
  //
  // `onLayout` reports the *border* box, so the box's own padding has to come
  // off first: counting it as text room made the preview ~7% too large, which
  // wrapped lines early and then clipped them.
  const innerWidth = Math.max(0, boxWidth - PREVIEW_PAD_X * 2);
  const scale = canvasWidth > 0 ? innerWidth / canvasWidth : 0;
  const leadingRatio =
    lineHeight && fontSize > 0 ? lineHeight / fontSize : DEFAULT_LEADING_RATIO;

  /** Ceiling for the type size, from the ink one line has to fit. */
  const maxPreviewFontSize =
    innerHeight / (leadingRatio + DIACRITIC_HEADROOM * 2);
  const previewFontSize = clamp(
    fontSize * scale,
    MIN_PREVIEW_PX,
    // On a very short window the floor wins over the ceiling.
    Math.max(MIN_PREVIEW_PX, maxPreviewFontSize),
  );

  const lineBox = previewFontSize * leadingRatio;
  const headroom = previewFontSize * DIACRITIC_HEADROOM;
  /**
   * Lines the reserved height can hold. Pinned as `numberOfLines` so a long
   * draft is ellipsized rather than allowed to grow the box: the sheet keeps its
   * height while typing, and no line can reach past its own headroom.
   */
  const maxLines = Math.max(
    1,
    Math.floor((innerHeight - headroom * 2) / lineBox),
  );

  const draft = text.trim();
  const blank = draft.length === 0;

  return (
    <View style={styles.preview}>
      <View style={styles.previewHead}>
        <Text
          style={[styles.previewCaption, { color: c.muted, fontFamily: font }]}
        >
          {t.editor.preview}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.previewCaption,
            { color: c.accentText, fontFamily: font },
          ]}
        >
          {fontLabel}
        </Text>
      </View>
      <View
        onLayout={onBoxLayout}
        style={[
          styles.previewBox,
          {
            height: budget,
            borderColor: c.border,
            backgroundColor: c.surfaceAlt,
          },
        ]}
      >
        <Text
          numberOfLines={maxLines}
          ellipsizeMode="tail"
          style={{
            fontFamily: fontKey,
            fontSize: previewFontSize,
            lineHeight: lineBox,
            /**
             * Carry the reserved headroom on the element itself.
             *
             * `numberOfLines` clips the element at its padding box, and the line
             * box is the design's leading — smaller than the face's ink. Without
             * this padding the clip sits exactly on the line box, so every
             * descender and haraka that reaches past it is sliced off (the م
             * tail was the reported case); the box reserves `headroom` above and
             * below for exactly that ink, but the element has to be told to let
             * it through. Vertical only, so the tail ellipsis still bites.
             */
            paddingVertical: headroom,
            color: blank ? c.faint : c.ink,
            textAlign: 'center',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          }}
        >
          {blank ? t.editor.previewSample : draft}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  numberLabel: { fontSize: typeScale.body.size },
  numberControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  numberValue: {
    minWidth: 56,
    textAlign: 'center',
    fontSize: typeScale.body.size,
    fontWeight: '600',
  },
  gauge: {},
  /**
   * Spacing between the stepper and the slider, as an explicit margin on a plain
   * wrapper *around* the `@expo/ui` control: Yoga applies `gap` between siblings,
   * but the Android `Host` is a native Compose-backed view, and spacing across
   * that boundary has been unreliable (see the session note) — a margin between
   * two regular RN views always holds.
   */
  gaugeGap: { marginTop: spacing.sm },
  preview: { gap: spacing.xs },
  previewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  previewCaption: {
    fontSize: typeScale.caption.size,
    lineHeight: typeScale.caption.lineHeight,
  },
  previewBox: {
    borderWidth: PREVIEW_BORDER,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    // Still a safety net rather than the cause: the ink is reserved for above,
    // so this only rounds off anything that overshoots anyway.
    overflow: 'hidden',
    paddingHorizontal: PREVIEW_PAD_X,
    paddingVertical: PREVIEW_PAD_Y,
  },
});
