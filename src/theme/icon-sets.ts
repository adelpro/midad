/**
 * Imported icons: where they come from, and which sets may be offered.
 *
 * Pure module — **no imports at all**, so `scripts/check-icons.mjs` can transpile
 * and evaluate it standalone (the same rule `remote-fonts.ts` follows).
 *
 * An icon is identified by `prefix:name` (Iconify's own addressing). A stored
 * `iconKey` is **provenance only**: the geometry travels in the document (see
 * `src/editor/icons/icon-geometry.ts`), so nothing here is dereferenced when a
 * design is opened. This module is the picker's half of the feature.
 */

/**
 * The public Iconify API hosts, tried in order.
 *
 * Iconify runs several servers behind one name and documents these hostnames as
 * the fallback for exactly this case: a client whose connection cannot reach the
 * primary. The second and third are not mirrors of each other — they point at
 * different halves of the fleet — so trying all three is the documented strategy
 * rather than a retry of the same name.
 */
export const ICONIFY_HOSTS = [
  'https://api.iconify.design',
  'https://api.simplesvg.com',
  'https://api.unisvg.com',
] as const;

/**
 * How many hits a search asks for.
 *
 * The API documents a **minimum** of 32 (and a default of 64, a maximum of 999),
 * so a smaller number is not a smaller page — it is a parameter the server
 * ignores. Asking for the minimum keeps a picker's first page small.
 */
export const ICON_SEARCH_LIMIT = 32;

/**
 * The sets the picker may offer, each with the licence its use rests on.
 *
 * **Monotone sets only.** `palette: true` (emoji, logos, flags) means the icon
 * carries baked colours, which cannot be rendered as a single inked path — the
 * whole point of importing a pictogram into a calligraphy editor is that it takes
 * the ink. A palette set is refused by the picker with a reason, not silently
 * recoloured.
 *
 * **Filled paths only.** The three renderers and the preview all draw a path by
 * *filling* it, so a set whose icons are outlines meant to be stroked
 * (`fill="none" stroke="…"`, as Tabler and Lucide are) would import as solid
 * silhouettes — not the icon the user picked. Those sets are left out rather than
 * drawn wrongly; adding stroke support is what would earn them a row here.
 *
 * `THIRD-PARTY-ICONS.md` is the human-readable copy of this table and
 * `scripts/check-icons.mjs` pins the two together, so a set cannot be offered
 * without its licence being recorded.
 *
 * The metadata here is copied from `GET /collections?prefixes=…`, which returns
 * each set's own declared licence.
 */
export const ICON_SET_ALLOWLIST = {
  'material-symbols': {
    name: 'Material Symbols',
    license: {
      title: 'Apache 2.0',
      spdx: 'Apache-2.0',
      url: 'https://github.com/google/material-design-icons/blob/master/LICENSE',
    },
  },
  mdi: {
    name: 'Material Design Icons',
    license: {
      title: 'Apache 2.0',
      spdx: 'Apache-2.0',
      url: 'https://github.com/Templarian/MaterialDesign/blob/master/LICENSE',
    },
  },
  ph: {
    name: 'Phosphor',
    license: {
      title: 'MIT',
      spdx: 'MIT',
      url: 'https://github.com/phosphor-icons/core/blob/main/LICENSE',
    },
  },
  bi: {
    name: 'Bootstrap Icons',
    license: {
      title: 'MIT',
      spdx: 'MIT',
      url: 'https://github.com/twbs/icons/blob/main/LICENSE.md',
    },
  },
};

/** The primary host, for a caller that does not want to walk the list. */
const PRIMARY_HOST = ICONIFY_HOSTS[0];

/**
 * The search endpoint. `limit` is clamped up to the API's minimum rather than
 * silently ignored.
 */
export function iconSearchUrl(query: string, limit: number): string {
  const effective = Math.max(ICON_SEARCH_LIMIT, Math.floor(limit) || 0);
  return (
    `${PRIMARY_HOST}/search?query=${encodeURIComponent(query)}` +
    `&limit=${effective}`
  );
}

/** One icon's data: its body plus the icon set's own viewBox. */
export function iconDataUrl(prefix: string, name: string): string {
  return (
    `${PRIMARY_HOST}/${encodeURIComponent(prefix)}.json` +
    `?icons=${encodeURIComponent(name)}`
  );
}

/** An icon's stored identity: `prefix:name`. */
export function iconKey(prefix: string, name: string): string {
  return `${prefix}:${name}`;
}

/**
 * Split a stored `prefix:name` back into its parts, or `null` if it is not one.
 *
 * Both halves must be non-empty; Iconify's own names contain single hyphens, so
 * a name is never a second colon.
 */
export function parseIconKey(
  key: string,
): { prefix: string; name: string } | null {
  if (typeof key !== 'string') {
    return null;
  }
  const colon = key.indexOf(':');
  if (colon <= 0 || colon === key.length - 1) {
    return null;
  }
  const prefix = key.slice(0, colon);
  const name = key.slice(colon + 1);
  if (!prefix || !name || name.includes(':')) {
    return null;
  }
  return { prefix, name };
}

/** Whether the picker may offer an icon from this set. */
export function isAllowedPrefix(prefix: string): boolean {
  return Object.prototype.hasOwnProperty.call(ICON_SET_ALLOWLIST, prefix);
}
