import type {
  CalligraphyTextObject,
  TextShadow,
} from "@/storage/project-schema";
import {
  ENGRAVE_HIGHLIGHT,
  ENGRAVE_SHADOW,
  SHADOW_INK,
} from "@/theme/content-palette";
import { fontAssets } from "@/theme/fonts";

/**
 * Presentation presets — the looks the Style navigator cycles through.
 *
 * These exist because the bundled calligraphy fonts ship **no stylistic
 * alternates**: parsing their `GSUB` tables shows only the automatic Arabic
 * shaping features (`ccmp`, `fina`, `init`, `medi`, `rlig`, `locl`, …) and no
 * `ss01`–`ss20`, `cv01`, `salt` or `dlig`. They are static fonts too, with no
 * `fvar` table, so there are no variable axes to drive either.
 *
 * A preset therefore changes what the renderer *can* express today: the weight
 * sibling the app already bundles, leading, opacity and Skia text shadows. If a
 * font with real alternates is ever added, it can be exposed here through
 * `SkTextStyle.fontFeatures` without touching the navigator.
 */

/** Leading ratio used for newly created text objects (lineHeight 120 / size 96). */
export const DEFAULT_LEADING_RATIO = 1.25;

/** The properties a preset is allowed to change. */
export interface PresentationPatch {
  fontKey?: string;
  fontSize?: number;
  lineHeight?: number;
  color?: string;
  opacity?: number;
  shadows?: TextShadow[];
}

export interface PresentationPreset {
  key: string;
  labelAr: string;
  labelEn: string;
  /** The look, resolved against the object's current state. */
  resolve: (obj: CalligraphyTextObject) => PresentationPatch;
}

const BOLD_SUFFIX = "-Bold";

/**
 * The registered bold sibling of a font key, or null when the app ships none.
 * Weight is available as separate static files, so switching weight is a key
 * swap rather than a font-feature toggle.
 */
export function boldSiblingForKey(fontKey: string): string | null {
  const base = fontKey.replace(/-Bold$/, "");
  const bold = `${base}${BOLD_SUFFIX}`;
  return bold in fontAssets ? bold : null;
}

/** The regular sibling of a bold font key, or null when it is already regular. */
export function regularSiblingForKey(fontKey: string): string | null {
  if (!fontKey.endsWith(BOLD_SUFFIX)) {
    return null;
  }
  const base = fontKey.slice(0, -BOLD_SUFFIX.length);
  return base in fontAssets ? base : null;
}

export const presentations: readonly PresentationPreset[] = [
  {
    key: "classic",
    labelAr: "أصلي",
    labelEn: "Classic",
    // The escape hatch: undoes every other preset, including weight.
    resolve: (obj) => ({
      fontKey: regularSiblingForKey(obj.fontKey) ?? obj.fontKey,
      lineHeight: Math.round(obj.fontSize * DEFAULT_LEADING_RATIO),
      opacity: 1,
      shadows: undefined,
    }),
  },
  {
    key: "bold",
    labelAr: "عريض",
    labelEn: "Bold",
    // The only preset that changes the *glyph forms* of the same typeface.
    resolve: (obj) => {
      const bold = boldSiblingForKey(obj.fontKey);
      return bold ? { fontKey: bold } : {};
    },
  },
  {
    key: "airy",
    labelAr: "فسيح",
    labelEn: "Airy",
    resolve: (obj) => ({ lineHeight: Math.round(obj.fontSize * 1.9) }),
  },
  {
    key: "tight",
    labelAr: "مضغوط",
    labelEn: "Tight",
    resolve: (obj) => ({ lineHeight: Math.round(obj.fontSize * 1.0) }),
  },
  {
    key: "soft",
    labelAr: "باهت",
    labelEn: "Soft",
    resolve: () => ({ opacity: 0.6 }),
  },
  {
    key: "shadow",
    labelAr: "ظلّ",
    labelEn: "Shadow",
    resolve: (obj) => ({
      shadows: [
        {
          color: SHADOW_INK,
          offsetX: 0,
          offsetY: Math.round(obj.fontSize * 0.06),
          blur: Math.max(1, Math.round(obj.fontSize * 0.1)),
        },
      ],
    }),
  },
  {
    key: "engraved",
    labelAr: "محفور",
    labelEn: "Engraved",
    resolve: (obj) => ({
      shadows: [
        {
          color: ENGRAVE_HIGHLIGHT,
          offsetX: 0,
          offsetY: -Math.round(obj.fontSize * 0.02),
          blur: Math.max(1, Math.round(obj.fontSize * 0.03)),
        },
        {
          color: ENGRAVE_SHADOW,
          offsetX: 0,
          offsetY: Math.round(obj.fontSize * 0.03),
          blur: Math.max(1, Math.round(obj.fontSize * 0.05)),
        },
      ],
    }),
  },
];

/** Look up a preset by its stored key. */
export function presentationByKey(
  key: string | undefined,
): PresentationPreset | undefined {
  return key === undefined
    ? undefined
    : presentations.find((p) => p.key === key);
}

/**
 * The patch that applies a preset: the resolved look plus the key, so the
 * navigator can show which preset the object is wearing. The key is only a
 * highlight hint — the resolved properties are what actually render.
 */
export function presetPatch(
  preset: PresentationPreset,
  obj: CalligraphyTextObject,
): PresentationPatch & { presentation: { key: string } } {
  return { ...preset.resolve(obj), presentation: { key: preset.key } };
}
