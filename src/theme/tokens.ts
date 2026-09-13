/**
 * midad design tokens — warm ink minimalist system.
 * Two palettes (light paper / dark ink) + spacing, radii, shadows, motion, type.
 */

import { Platform, type ViewStyle } from "react-native";

export interface MidadPalette {
  // Canvas & surfaces
  paper: string; // app background
  paperBright: string; // brighter paper
  surface: string; // cards / sheets
  surfaceAlt: string; // subtle surface
  surfacePressed: string; // pressed surface

  // Ink — text & solids
  ink: string; // primary text / solid CTA
  inkSoft: string; // secondary strong text
  muted: string; // secondary text
  faint: string; // tertiary text / disabled
  onInk: string; // text on ink

  // Structural lines
  border: string; // hairline borders
  borderStrong: string; // stronger dividers

  // Accent — ink-saffron, used sparingly
  accent: string;
  accentText: string;
  accentSoft: string; // accent tint background

  // Pale pastels (tags / semantic hints)
  paleRed: { bg: string; text: string };
  paleBlue: { bg: string; text: string };
  paleGreen: { bg: string; text: string };
  paleYellow: { bg: string; text: string };

  // Semantic
  danger: string;
  dangerBg: string;
  success: string;
  successBg: string;

  // Shadows
  shadowColor: string;
  shadowOpacity: number;
}

export type ColorScheme = "light" | "dark";

/** Light — warm bone / paper. */
const lightColors: MidadPalette = {
  paper: "#F7F6F3",
  paperBright: "#FBFBFA",
  surface: "#FFFFFF",
  surfaceAlt: "#F9F9F8",
  surfacePressed: "#EFEEE9",

  ink: "#111111",
  inkSoft: "#2F3437",
  muted: "#787774",
  faint: "#A9A69F",
  onInk: "#FFFFFF",

  border: "#EAEAEA",
  borderStrong: "#D8D5CE",

  accent: "#B0894F",
  accentText: "#956400",
  accentSoft: "#F5EEE2",

  paleRed: { bg: "#FDEBEC", text: "#9F2F2D" },
  paleBlue: { bg: "#E1F3FE", text: "#1F6C9F" },
  paleGreen: { bg: "#EDF3EC", text: "#346538" },
  paleYellow: { bg: "#FBF3DB", text: "#956400" },

  danger: "#9F2F2D",
  dangerBg: "#FDEBEC",
  success: "#346538",
  successBg: "#EDF3EC",

  shadowColor: "#111111",
  shadowOpacity: 0.06,
};

/** Dark — warm ink / charcoal. Inverts paper↔ink. */
const darkColors: MidadPalette = {
  paper: "#16150F",
  paperBright: "#1D1B14",
  surface: "#211F18",
  surfaceAlt: "#26241C",
  surfacePressed: "#2E2B22",

  ink: "#F2EFE7",
  inkSoft: "#D8D4C9",
  muted: "#9A968C",
  faint: "#6B675F",
  onInk: "#16150F",

  border: "#33312A",
  borderStrong: "#45423A",

  accent: "#C9A05C",
  accentText: "#E0B878",
  accentSoft: "#2E2920",

  paleRed: { bg: "#2E1F1E", text: "#E8A6A3" },
  paleBlue: { bg: "#142A38", text: "#8FC4E8" },
  paleGreen: { bg: "#1C2A1B", text: "#9CC694" },
  paleYellow: { bg: "#2E2818", text: "#D9BE7E" },

  danger: "#E8A6A3",
  dangerBg: "#2E1F1E",
  success: "#9CC694",
  successBg: "#1C2A1B",

  shadowColor: "#000000",
  shadowOpacity: 0.4,
};

export const palettes: Record<ColorScheme, MidadPalette> = {
  light: lightColors,
  dark: darkColors,
};

/** Light palette — kept for static non-themed defaults. */
export const colors: MidadPalette = lightColors;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  pill: 9999,
} as const;

/** One step of the elevation ramp: dp offset + blur, plus the Android z-order. */
export interface ShadowSpec {
  /** Vertical offset in dp; negative casts upward (bottom sheets). */
  offsetY: number;
  /** Blur radius in dp. */
  blurRadius: number;
  /** Android `elevation`: the shadow below API 28, and z-order everywhere. */
  elevation: number;
}

/**
 * The elevation ramp. Only these four surfaces lift off the page — everything
 * else separates by tone and hairlines, never by stacked borders.
 */
export const shadows = {
  /** Resting card. */
  card: { offsetY: 2, blurRadius: 8, elevation: 1 },
  /** Panel lifted over the page (modal sheet). */
  panel: { offsetY: 2, blurRadius: 8, elevation: 1 },
  /** Floating bar over the content (snackbar). */
  float: { offsetY: 4, blurRadius: 16, elevation: 8 },
  /** Bottom sheet, anchored to the bottom edge — so it casts upward. */
  sheet: { offsetY: -4, blurRadius: 16, elevation: 8 },
} as const;

/** `#RRGGBB` + alpha → `rgba()`; every palette shadow ink is hex. */
function shadowInk(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${alpha})`;
}

/**
 * Elevation → platform styles.
 *
 * Web gets `boxShadow`: react-native-web 0.21 warns once that the `shadow*`
 * props are deprecated, and rewrites them to `boxShadow` internally anyway.
 * Native keeps `shadow*` + `elevation` — React Native still recommends those
 * props, `elevation` also drives Android z-order, and `boxShadow` only paints
 * on Android API 28+ (below that it is a silent no-op).
 */
export function elevationStyle(
  colors: MidadPalette,
  spec: ShadowSpec,
): ViewStyle {
  if (Platform.OS === "web") {
    return {
      boxShadow: `0 ${spec.offsetY}px ${spec.blurRadius}px ${shadowInk(
        colors.shadowColor,
        colors.shadowOpacity,
      )}`,
    };
  }
  return {
    shadowColor: colors.shadowColor,
    shadowOpacity: colors.shadowOpacity,
    shadowRadius: spec.blurRadius,
    shadowOffset: { width: 0, height: spec.offsetY },
    elevation: spec.elevation,
  };
}

/** Layout breakpoints (dp): phone-first; `wide` switches to tablet/desktop. */
export const breakpoint = {
  wide: 600,
} as const;

/**
 * Layout caps (dp). On large displays the app keeps working to a
 * phone-proportioned measure and centres it, rather than stretching to the
 * window — see DESIGN.md §5 ("web adapts, never leads").
 */
export const layout = {
  /** Widest a single content column may grow (onboarding, forms, empty states). */
  maxContent: 480,
  /** Widest a standalone control (segmented track, single button group) may grow. */
  maxControl: 320,
  /** Widest a horizontal chrome bar's content may grow before it centres. */
  maxToolbar: 560,
} as const;

export const motion = {
  fast: 150,
  base: 250,
  slow: 400,
  // EaseOutQuint — quiet sophistication
  ease: [0.16, 1, 0.3, 1] as const,
  // Staggered reveal step
  staggerStep: 80,
} as const;

/**
 * Spring damping ratios (ζ) — the number you actually tune.
 *
 * `1` is critically damped: the fastest approach that never overshoots. Below
 * `1` overshoots (used to keep momentum), above `1` is sluggish.
 */
const springRatio = {
  ui: 1.0,
  momentum: 0.8,
  sheet: 0.85,
  exit: 1.0,
} as const;

/**
 * Reanimated's `withSpring` takes an **absolute damping coefficient**, not a
 * ratio — it derives the ratio itself as `damping / (2 * sqrt(stiffness * mass))`.
 * Handing it a ratio (0–1) as `damping` therefore produces a spring that is
 * roughly thirty times underdamped, which rings visibly back and forth for
 * seconds instead of settling. Always build the coefficient from a ratio here.
 */
function dampingFor(ratio: number, stiffness: number, mass = 1): number {
  return 2 * ratio * Math.sqrt(stiffness * mass);
}

/**
 * Spring presets (DESIGN.md §6). Interactive elements settle by spring, never
 * by duration — a tween cannot absorb an interruption mid-flight, a spring can.
 * Feed these straight to Reanimated's `withSpring`.
 */
export const springs = {
  /** Presses, toggles, thumbs — ζ 1.0, so there is no visible bounce. */
  ui: { damping: dampingFor(springRatio.ui, 260), stiffness: 260, mass: 1 },
  /** Flicks and throws — ζ 0.8, so a released gesture keeps some momentum. */
  momentum: {
    damping: dampingFor(springRatio.momentum, 320),
    stiffness: 320,
    mass: 1,
  },
  /** Sheets and other large surface entry/exit — ζ 0.85. */
  sheet: {
    damping: dampingFor(springRatio.sheet, 300),
    stiffness: 300,
    mass: 1,
  },
  /**
   * Dismissals — the other half of an asymmetric pair. ζ 1.0 and stiffer, so a
   * bar or panel leaving snaps out instead of settling.
   */
  exit: { damping: dampingFor(springRatio.exit, 380), stiffness: 380, mass: 1 },
} as const;

/**
 * The presets as plain damping ratios, for APIs that take a ratio rather than a
 * coefficient — notably React Native's `LayoutAnimation.springDamping`.
 */
export const springDampingRatios = springRatio;

export const typeScale = {
  // Negative letter-spacing visually breaks Arabic cursive joins, and the app
  // is Arabic-first — keep tracking at 0 for display/title/heading sizes.
  display: { size: 40, lineHeight: 44, letterSpacing: 0 },
  title: { size: 32, lineHeight: 36, letterSpacing: 0 },
  heading: { size: 24, lineHeight: 30, letterSpacing: 0 },
  subheading: { size: 18, lineHeight: 26, letterSpacing: 0 },
  body: { size: 16, lineHeight: 24, letterSpacing: 0 },
  small: { size: 14, lineHeight: 20, letterSpacing: 0 },
  caption: { size: 12, lineHeight: 16, letterSpacing: 0 },
  micro: { size: 11, lineHeight: 14, letterSpacing: 0.02 },
} as const;

export type TypeVariant = keyof typeof typeScale;

// Tag micro-typography — uppercase, wide tracking (per minimalist-ui).
export const tagType = {
  fontSize: 10,
  lineHeight: 12,
  letterSpacing: 0.05,
  textTransform: "uppercase" as const,
};
