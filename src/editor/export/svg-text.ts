/**
 * Pure SVG text serialization — no imports, so `scripts/check-fonts.mjs` can
 * transpile and evaluate this module standalone. Kept out of `svg.ts` because
 * that module pulls in `expo-asset` and cannot be transpiled.
 */

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Render a text object as a centred stack of `<tspan>` lines. `lines` are the
 * visual lines (soft wraps already resolved by the caller), so a narrowed text
 * box exports the same line breaks the canvas shows.
 *
 * `fontFamily` must be the `@font-face` family emitted for this object's face,
 * or the embedded font is never applied and the viewer substitutes one.
 */
export function textToSvg(
  lines: string[],
  fontSize: number,
  lineHeight: number,
  color: string,
  fontFamily: string,
  filterId?: string,
): string {
  const sample = lines.join(' ');
  const isArabic = /[\u0600-\u06FF]/.test(sample);
  const rtl = isArabic ? ' direction="rtl" unicode-bidi="plaintext"' : '';
  const filterAttr = filterId ? ` filter="url(#${filterId})"` : '';
  const dy0 = -((lines.length - 1) * lineHeight) / 2;
  const spans = lines
    .map(
      (line, i) =>
        `<tspan x="0" dy="${i === 0 ? dy0 : lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join('');
  return (
    `<text x="0" y="0" text-anchor="middle" dominant-baseline="middle"` +
    ` font-family="${escapeXml(fontFamily)}"` +
    ` font-size="${fontSize}" fill="${escapeXml(color)}"${filterAttr}${rtl}>${spans}</text>`
  );
}
