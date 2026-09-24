/**
 * Remote-font identity and lookup for the Google Fonts runtime feature.
 *
 * This module is deliberately pure and import-free: `scripts/check-remote-fonts.mjs`
 * transpiles and evaluates it standalone, exactly like the other checks treat
 * `font-families.ts` / `shortcuts.ts`. No React Native, no DOM, no fetch.
 *
 * Remote faces are identified by a `fontKey` of the form
 * `remote:<fontsource-id>:<weight>` (e.g. `remote:markazi-text:400`). The id is
 * the Fontsource slug (`normalizeRemoteFontId`), which normalises identically on
 * every platform, so a `.midad` document written on web resolves the same face
 * on native.
 *
 * `fontKey` is a plain string on the object model (like the bundled
 * `'Amiri-Bold'` keys); `REMOTE_PREFIX` keeps the two namespaces apart.
 */

/** Prefix that marks a runtime-downloaded Google Font face. */
export const REMOTE_PREFIX = 'remote:';

/**
 * `remote:<id>:<weight>` where `<id>` is a lowercase hyphenated slug and
 * `<weight>` is a three-digit CSS weight (100–900). Uppercase ids are rejected:
 * every key the app creates is normalised through `remoteFontKey`, so a key
 * with an uppercase slug is malformed, never a real face.
 */
export const REMOTE_FONT_KEY_PATTERN = /^remote:[a-z0-9-]+:[1-9]\d{2}$/;

/** A remote font key, e.g. `'remote:markazi-text:400'`. */
export type RemoteFontKey = string;

/** Parsed form of a remote font key. */
export interface ParsedRemoteFontKey {
  /** Fontsource slug, e.g. `'markazi-text'`. */
  id: string;
  /** CSS weight, e.g. 400. */
  weight: number;
}

/** Every resolved face falls into exactly one of these states. */
export type FaceStatus =
  /** Key is a bundled registry entry (a `FontKey`). */
  | 'bundled'
  /** `remote:<…>` and the face is downloaded on this device. */
  | 'remote-installed'
  /** `remote:<…>` but not downloaded here (yet) — drive a re-download prompt. */
  | 'remote-missing'
  /** Anything else — treat as missing, never silently as Amiri. */
  | 'unknown';

/** One family as served by `api.fontsource.org/v1/fonts`. */
export interface RemoteFontFamily {
  /** Fontsource slug, e.g. `'markazi-text'`. */
  id: string;
  /** Display name, e.g. `'Markazi Text'`. */
  family: string;
  readonly subsets: string[];
  readonly weights: number[];
  readonly styles: string[];
  defSubset: string;
  variable: boolean;
  category: string | null;
  license: string;
  /** `'google'` for the Google Fonts mirror; other entries are filtered out. */
  type: string;
}

/** True when `key` is a well-formed remote font key. */
export function isRemoteFontKey(key: string): key is RemoteFontKey {
  return REMOTE_FONT_KEY_PATTERN.test(key);
}

/**
 * Build a remote font key. The id is normalised and the weight clamped to the
 * 100–900 CSS range, so the result always matches `REMOTE_FONT_KEY_PATTERN`.
 */
export function remoteFontKey(id: string, weight: number): string {
  const slug = normalizeRemoteFontId(id);
  const w = normalizeRemoteWeight(weight);
  return `${REMOTE_PREFIX}${slug}:${w}`;
}

/** Split a remote font key back into id + weight, or `null` if malformed. */
export function parseRemoteFontKey(key: string): ParsedRemoteFontKey | null {
  if (!isRemoteFontKey(key)) {
    return null;
  }
  const colon = key.lastIndexOf(':');
  const id = key.slice(REMOTE_PREFIX.length, colon);
  const weight = Number(key.slice(colon + 1));
  return { id, weight };
}

/**
 * Normalise a family name to a Fontsource slug: lowercase, runs of
 * non-alphanumerics become a single hyphen, edges trimmed.
 */
export function normalizeRemoteFontId(id: string): string {
  const slug = id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'font';
}

/** Coerce a weight to an integer in the 100–900 CSS range (fallback 400). */
export function normalizeRemoteWeight(weight: number): number {
  const w = Math.round(weight);
  if (Number.isNaN(w)) {
    return 400;
  }
  return Math.min(900, Math.max(100, w));
}

/**
 * Resolve the status of a `fontKey`.
 *
 * Pure: callers supply the two predicates so this module stays import-free (the
 * real ones live in the editor: `Object.hasOwn` over the bundle registry for
 * bundled and the font cache for remote). Precedence is deliberate — a bundled
 * key can never be `remote-missing`, and an unknown key is `'unknown'`, never
 * `'bundled'` — so a face that vanished from the registry fails loudly instead
 * of silently rendering Amiri.
 */
export function faceStatusForKey(
  fontKey: string,
  isBundled: (key: string) => boolean,
  isRemoteInstalled: (key: string) => boolean,
): FaceStatus {
  if (isRemoteFontKey(fontKey)) {
    return isRemoteInstalled(fontKey) ? 'remote-installed' : 'remote-missing';
  }
  return isBundled(fontKey) ? 'bundled' : 'unknown';
}

/**
 * Direct per-subset TTF download URL on the Fontsource CDN, which mirrors
 * `github.com/google/fonts` (the same source the bundled faces came from).
 * CORS-open on every platform, so native and web download the same bytes.
 */
export function remoteFontTtfUrl(
  id: string,
  weight: number,
  subset = 'arabic',
): string {
  const slug = normalizeRemoteFontId(id);
  const w = normalizeRemoteWeight(weight);
  const s = subset.replace(/[^a-z0-9-]/g, '');
  return `https://cdn.jsdelivr.net/fontsource/fonts/${slug}@latest/${s}-${w}-normal.ttf`;
}
