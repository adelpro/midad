import { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { Icon, IconButton, Slider } from "@/components/ui";
import { hapticTick } from "@/haptics";
import { useTheme } from "@/hooks/use-theme";
import { useT } from "@/i18n";
import {
  DEFAULT_LEADING_RATIO,
  fontRoles,
  radius,
  spacing,
  typeScale,
} from "@/theme";

/**
 * Typography controls for the editor's text sheets, split out of
 * `EditorScreen.tsx` because they are self-contained and the screen is already
 * the largest file in the app.
 */

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** Floor for the preview's type size (dp) — keeps the smallest sizes legible. */
const MIN_PREVIEW_PX = 10;
/**
 * Ceiling for the preview's type size, as a fraction of the box height.
 *
 * Kept below `1 / DEFAULT_LEADING_RATIO` so the cap still leaves one whole line
 * on screen: the preview exists to show *how big* the text will be, and a size
 * that cannot fit a single line would say nothing at all.
 */
const MAX_PREVIEW_FRACTION = 0.75;
/** Preview box height (dp). */
const PREVIEW_HEIGHT = 116;

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
  height?: number;
}

/**
 * Mini canvas: the text set in the chosen face at its true relative size.
 *
 * Rendered with a plain RN `<Text>` rather than Skia. The shapes are the same
 * font file and the size is the same *fraction* of the artwork, so the face and
 * the size are honest — but plain text will not match the canvas's HarfBuzz
 * shaping glyph for glyph. That trade buys a preview that costs nothing to
 * re-render on every keystroke, which is what makes it live.
 */
export function TextPreview({
  text,
  fontKey,
  fontLabel,
  fontSize,
  lineHeight,
  canvasWidth,
  height = PREVIEW_HEIGHT,
}: TextPreviewProps) {
  const { colors: c } = useTheme();
  const { t, language, isRTL } = useT();
  const font = fontRoles[language].ui;
  /** Measured box width — the other half of the canvas scale reference. */
  const [boxWidth, setBoxWidth] = useState(0);

  const onBoxLayout = useCallback((e: LayoutChangeEvent) => {
    setBoxWidth(e.nativeEvent.layout.width);
  }, []);

  // The same relative size as the canvas: a 96pt title on a 1080-wide artwork
  // covers the same fraction of the preview as it does of the artwork.
  const scale = canvasWidth > 0 ? boxWidth / canvasWidth : 0;
  const previewFontSize = clamp(
    fontSize * scale,
    MIN_PREVIEW_PX,
    height * MAX_PREVIEW_FRACTION,
  );
  const leadingRatio =
    lineHeight && fontSize > 0 ? lineHeight / fontSize : DEFAULT_LEADING_RATIO;

  const draft = text.trim();
  const blank = draft.length === 0;

  return (
    <View style={styles.preview}>
      <View style={styles.previewHead}>
        <Text
          style={[
            styles.previewCaption,
            { color: c.muted, fontFamily: font },
          ]}
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
          { height, borderColor: c.border, backgroundColor: c.surfaceAlt },
        ]}
      >
        <Text
          style={{
            fontFamily: fontKey,
            fontSize: previewFontSize,
            lineHeight: previewFontSize * leadingRatio,
            color: blank ? c.faint : c.ink,
            textAlign: "center",
            writingDirection: isRTL ? "rtl" : "ltr",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  numberLabel: { fontSize: typeScale.body.size },
  numberControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  numberValue: {
    minWidth: 56,
    textAlign: "center",
    fontSize: typeScale.body.size,
    fontWeight: "600",
  },
  gauge: { gap: spacing.xs },
  preview: { gap: spacing.xs },
  previewHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  previewCaption: {
    fontSize: typeScale.caption.size,
    lineHeight: typeScale.caption.lineHeight,
  },
  previewBox: {
    borderWidth: 1,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: spacing.md,
  },
});
