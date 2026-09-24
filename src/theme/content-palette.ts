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
  '#111111',
  '#7a1f1f',
  '#1f4e79',
  '#1f6c3b',
  '#b0894f',
  '#ffffff',
] as const;

/** Paper and ground tones offered by the background tool. */
export const paperSwatches = [
  '#f7f6f3',
  '#ffffff',
  '#111111',
  '#e8e2d5',
  '#2c3e50',
  '#5c4033',
] as const;

/** Default fill for a newly created text object. */
export const DEFAULT_INK = '#111111';

/** Default paper colour for a new project. */
export const DEFAULT_PAPER = '#f7f6f3';

/**
 * Shadow colours used by the presentation presets. Kept as translucent rgba so
 * the shadow reads as light rather than as a second colour.
 */
export const SHADOW_INK = 'rgba(17, 17, 17, 0.35)';
export const ENGRAVE_HIGHLIGHT = 'rgba(255, 255, 255, 0.55)';
export const ENGRAVE_SHADOW = 'rgba(17, 17, 17, 0.28)';
