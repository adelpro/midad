/**
 * Pin identity for the font picker.
 *
 * A pinned entry names a family, and families come from two registries whose
 * keys can collide (`amiri` is both a bundled family key and a Fontsource id),
 * so the pin id carries its source. Pure and import-free: `check-font-pins.mjs`
 * transpiles and evaluates this module standalone, so a value import would break
 * the check silently (the `remote-fonts.ts` rule).
 */

/** Which registry a pin id names. */
export type FontPinSource = 'family' | 'google';

/** `family:<familyKey>` for bundled families, `google:<fontId>` for remote. */
export type FontPinId = `family:${string}` | `google:${string}`;

/** `family:`/`google:` plus a slug. The only two legal forms. */
const PIN_PATTERN = /^(family|google):([a-z0-9-]+)$/;

/** The bundled-family pin id for a registry key (e.g. `amiri`). */
export function familyPinId(familyKey: string): FontPinId {
  return `family:${familyKey}`;
}

/** The remote-family pin id for a Fontsource id (e.g. `markazi-text`). */
export function googlePinId(fontId: string): FontPinId {
  return `google:${fontId}`;
}

/**
 * Parse a pin id back to its source and key, or `null` for anything that is not
 * one of the two legal forms. The single validating gate.
 */
export function parseFontPinId(
  id: string,
): { source: FontPinSource; key: string } | null {
  const match = PIN_PATTERN.exec(id);
  if (!match) {
    return null;
  }
  return { source: match[1] as FontPinSource, key: match[2] };
}

/** True when `id` is a well-formed pin id. */
export function isFontPinId(id: string): id is FontPinId {
  return PIN_PATTERN.test(id);
}

/** Move `id` to the front, or remove it when already present. */
export function togglePinnedId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids];
}

/**
 * Prepend when pinning, filter when unpinning, or `null` when the state already
 * matches — the `null` lets the store return its previous state and skip a
 * render.
 */
export function setPinnedId(
  ids: string[],
  id: string,
  pinned: boolean,
): string[] | null {
  if (ids.includes(id) === pinned) {
    return null;
  }
  return pinned ? [id, ...ids] : ids.filter((x) => x !== id);
}
