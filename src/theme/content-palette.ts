/**
 * Canvas **content** colours — values that are written into project files as
 * part of the artwork, as opposed to UI chrome.
 *
 * DESIGN.md bans hardcoded hex in screens and components, with exactly one
 * exception: canvas content palettes, "grouped in named constants with a content
 * comment". This module is that grouping.
 */

/** Ink and accent swatches offered by the colour tool. */
export const inkSwatches = [
  "#111111",
  "#7A1F1F",
  "#1F4E79",
  "#1F6C3B",
  "#B0894F",
  "#FFFFFF",
] as const;

/** Paper and ground tones offered by the background tool. */
export const paperSwatches = [
  "#F7F6F3",
  "#FFFFFF",
  "#111111",
  "#E8E2D5",
  "#2C3E50",
  "#5C4033",
] as const;

/** Default fill for a newly created text object. */
export const DEFAULT_INK = "#111111";

/** Default paper colour for a new project. */
export const DEFAULT_PAPER = "#F7F6F3";

/**
 * Shadow colours used by the presentation presets. Kept as translucent rgba so
 * the shadow reads as light rather than as a second colour.
 */
export const SHADOW_INK = "rgba(17, 17, 17, 0.35)";
export const ENGRAVE_HIGHLIGHT = "rgba(255, 255, 255, 0.55)";
export const ENGRAVE_SHADOW = "rgba(17, 17, 17, 0.28)";
