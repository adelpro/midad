/**
 * Canvas **content** colour parsing.
 *
 * A colour that reaches the document, Skia and the SVG exporter has exactly one
 * accepted shape: `#rrggbb`. Users, though, type it the way they know it, so the
 * picker's custom field accepts the common CSS spellings — `#abc`, `#aabbcc`,
 * `rgb(r,g,b)` and `rgba(r,g,b,a)` — and this module normalises them to the
 * canonical form.
 *
 * Alpha is validated but **dropped**: every object already carries a separate
 * `opacity` field, so an alpha channel in the string would be a second,
 * contradictory control. `rgba()` is accepted only so a value copied from
 * elsewhere does not have to be rewritten by hand.
 *
 * Pure and import-free on purpose — `scripts/check-color.mjs` transpiles and
 * evaluates it standalone, the same way the other check scripts treat their
 * subjects, so a value import would silently break that check.
 */

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i;
const RGBA =
  /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d*\.?\d+)\s*\)$/i;

/** One 0–255 channel as two lowercase hex digits. */
const channel = (n: number): string => n.toString(16).padStart(2, '0');

const rgbHex = (r: number, g: number, b: number): string =>
  `#${channel(r)}${channel(g)}${channel(b)}`;

/**
 * Normalise a typed colour to `#rrggbb`, or `null` when it is not a colour this
 * app can store.
 *
 * The leading `#` is optional for hex and case is ignored, so `#ABC`, `abc` and
 * `#aabbcc` all resolve to `#aabbcc`. Hex shorthand is expanded rather than
 * padded. `rgb()`/`rgba()` components must be whole numbers in 0–255 and, for
 * `rgba()`, alpha a number in 0–1; anything out of range is rejected rather than
 * clamped, because a silent clamp hides a typo.
 */
export function parseColor(input: string): string | null {
  const value = input.trim();
  if (value.length === 0) {
    return null;
  }

  const hex = HEX.exec(value);
  if (hex) {
    const digits = hex[1].toLowerCase();
    return digits.length === 3
      ? `#${digits
          .split('')
          .map((d) => d + d)
          .join('')}`
      : `#${digits}`;
  }

  const rgb = RGB.exec(value);
  if (rgb) {
    const [r, g, b] = rgb.slice(1).map(Number);
    if (r > 255 || g > 255 || b > 255) {
      return null;
    }
    return rgbHex(r, g, b);
  }

  const rgba = RGBA.exec(value);
  if (rgba) {
    const [r, g, b] = rgba.slice(1, 4).map(Number);
    const a = Number(rgba[4]);
    if (r > 255 || g > 255 || b > 255 || a < 0 || a > 1) {
      return null;
    }
    return rgbHex(r, g, b);
  }

  return null;
}
