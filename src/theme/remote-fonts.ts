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
 * Title-case a Fontsource slug for display: `'markazi-text'` → `'Markazi Text'`.
 * A rough humanization, not a real name lookup — the catalog's `family` field
 * is the authoritative display name, which this pure module cannot know.
 */
export function humanizeRemoteFontId(id: string): string {
  return normalizeRemoteFontId(id)
    .split('-')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * A readable label for a remote face — e.g. `'Markazi Text · 400'` — or `null`
 * when `fontKey` is not a remote key. Callers use it where only the key is at
 * hand (a text object's `fontKey`, the FontField line), before the catalog's
 * display name is available.
 */
export function remoteFontLabel(fontKey: string): string | null {
  const parsed = parseRemoteFontKey(fontKey);
  if (!parsed) {
    return null;
  }
  return `${humanizeRemoteFontId(parsed.id)} · ${parsed.weight}`;
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
 * A Google family paired with the bundled family it duplicates, if any.
 * Only the fields the decision needs, so callers can pass catalogue rows and
 * registry rows through the same function.
 */
export interface BundledDuplicateCandidate {
  id: string;
  family: string;
  weights: readonly number[];
}

/** Case- and separator-insensitive key for matching a name against the bundle. */
function foldTypefaceName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Drop the Google families that merely re-offer a bundled face.
 *
 * The picker lists the bundled families *and* searches Google under the same
 * query, so any bundled face that also exists upstream appeared twice — once
 * bundled, once under "Google Fonts" — for no gain. This removes the second
 * copy, but only when it is genuinely redundant: if Google offers a weight the
 * bundled copy lacks (`Kufam` is bundled at 400 only, upstream ships 400–900),
 * the row is a real upgrade and stays, because the bundled variants cannot
 * reach those weights.
 *
 * `bundledWeights` maps a folded bundled name to the weights that family
 * provides. Matching is deliberately loose on punctuation and case, because the
 * two registries spell the same face differently: Google's `noto-naskh-arabic`
 * is the bundle's `noto-naskh`, whose own label drops the "arabic".
 *
 * Pure: the caller supplies the coverage map, so this module stays import-free
 * and never reads the bundled registry itself.
 */
export function filterBundledDuplicates<T extends BundledDuplicateCandidate>(
  families: readonly T[],
  bundledWeights: ReadonlyMap<string, readonly number[]>,
): T[] {
  return families.filter((family) => {
    const bundled = bundledWeights.get(foldTypefaceName(family.id));
    if (!bundled) {
      return true;
    }
    // An unknown weight list on either side is not evidence of redundancy:
    // showing a row the user can no longer pick is worse than showing a twin.
    if (bundled.length === 0 || family.weights.length === 0) {
      return true;
    }
    return family.weights.some((weight) => !bundled.includes(weight));
  });
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
