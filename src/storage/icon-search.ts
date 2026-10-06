import { iconPathsFromBody, type IconPath } from '@/editor/icons/icon-geometry';
import {
  ICONIFY_HOSTS,
  ICON_SEARCH_LIMIT,
  iconSearchUrl,
  isAllowedPrefix,
  isImportableIcon,
  parseIconKey,
} from '@/theme/icon-sets';

/**
 * Searching the Iconify catalogue and fetching one icon's geometry.
 *
 * ## What is cached, and what is not
 *
 * Nothing. The font subsystem keeps a device cache because a *font file* is
 * referenced by key and re-resolved on every load — a design naming Gulzar needs
 * Gulzar bytes forever. An icon is the opposite: its geometry is resolved once,
 * at insert time, and then travels **inside the document**. There is nothing to
 * invalidate for a design, so the only thing a cache would speed up is a second
 * search in the same session, which the picker's own state already covers.
 *
 * ## Failure
 *
 * `searchIcons` throws when every host fails, so the picker has a single failure
 * path to render instead of a silently empty list. It also drops every hit the
 * picker cannot import (a set outside the allowlist, a palette set) **before**
 * returning, so an unsupported icon is never a row at all. The one refusal that
 * needs the body — a monotone set whose single icon paints its own colour — is
 * resolved later by `fetchIconPreviews`, which resolves that hit to `null`; the
 * sheet then hides it. `fetchIcon` returns `null` for the same reasons.
 */

/** One search hit, resolved enough to decide whether it can be imported. */
export interface IconSearchHit {
  /** `prefix:name`. */
  key: string;
  prefix: string;
  name: string;
  /** The set's display name, from the response's `collections` block. */
  setName: string;
  /** Whether the set bakes its own colours, which this app cannot ink. */
  palette: boolean;
  /** Whether the picker may offer this set at all. */
  allowed: boolean;
}

/** A fetched icon, ready to become an `IconObject`. */
export interface FetchedIcon {
  paths: IconPath[];
  viewBox: { width: number; height: number };
}

/**
 * Ask each host in turn for `fetch(url)` and return the first that answers `ok`.
 *
 * Iconify's own components do exactly this: the backup hostnames point at
 * different halves of the fleet, so a failure on one says nothing about the
 * others. The last error is rethrown so the caller has something to report.
 */
async function fetchFirstHost(
  buildUrl: (host: string) => string,
): Promise<Response> {
  let lastError: unknown = null;
  for (const host of ICONIFY_HOSTS) {
    try {
      const response = await fetch(buildUrl(host));
      if (response.ok) {
        return response;
      }
      lastError = new Error(`icon host ${host} answered ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('icon-search-failed');
}

/**
 * Search the catalogue. Throws when no host answers, so the caller can show a
 * failure rather than an empty result.
 */
export async function searchIcons(query: string): Promise<IconSearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const response = await fetchFirstHost((host) =>
    // `iconSearchUrl` builds against the primary; re-rooting it on the host
    // being tried keeps one URL definition rather than three.
    iconSearchUrl(trimmed, ICON_SEARCH_LIMIT).replace(
      ICONIFY_HOSTS[0] as string,
      host,
    ),
  );
  const payload = (await response.json()) as {
    icons?: string[];
    collections?: Record<
      string,
      { name?: string; palette?: boolean } | undefined
    >;
  };
  const icons = Array.isArray(payload.icons) ? payload.icons : [];
  const collections = payload.collections ?? {};

  return (
    icons
      .map((key) => {
        const parsed = parseIconKey(key);
        if (!parsed) {
          return null;
        }
        const collection = collections[parsed.prefix];
        return {
          key,
          prefix: parsed.prefix,
          name: parsed.name,
          setName: collection?.name ?? parsed.prefix, // An absent `collections` entry means the response drifted from the
          // documented shape; treating it as palette-bearing is the safe default,
          // because that only ever disables a row rather than letting an
          // un-inkable icon through.
          palette: collection ? collection.palette === true : true,
          allowed: isAllowedPrefix(parsed.prefix),
        };
      })
      .filter((hit): hit is IconSearchHit => hit !== null)
      // Set-level refusals are knowable now, so they never reach the list.
      .filter((hit) => isImportableIcon(hit))
  );
}

/** What one hit's preview needs: the geometry, or why there is none. */
export interface IconPreview {
  /** Drawable paths, in viewBox units, or `null` when the icon is refused. */
  paths: IconPath[] | null;
  viewBox: { width: number; height: number };
}

/**
 * Resolve the **geometry** for a batch of hits — one request per icon set.
 *
 * The search response carries names only, so a list of hits has nothing to draw
 * from; resolving each one individually would be a request per row on every
 * keystroke. The data endpoint takes a comma-separated list, so a page of hits
 * costs one request per *set* it spans (usually one or two).
 *
 * This is also what answers "can this be imported?" honestly. The set-level
 * `palette` flag is a hint; the body is the truth, so a row's availability and
 * its preview are the same computation.
 *
 * A hit that is not allowed, or whose set fails to answer, is simply absent from
 * the map — the caller renders it as unavailable rather than as a failed load.
 */
export async function fetchIconPreviews(
  hits: readonly IconSearchHit[],
): Promise<Map<string, IconPreview>> {
  const previews = new Map<string, IconPreview>();
  const wanted = hits.filter((hit) => hit.allowed && !hit.palette);
  if (wanted.length === 0) {
    return previews;
  }

  // Group by set: the endpoint is per-set, and asking twice for one set is how a
  // page of hits would turn back into many requests.
  const byPrefix = new Map<string, IconSearchHit[]>();
  for (const hit of wanted) {
    const list = byPrefix.get(hit.prefix);
    if (list) {
      list.push(hit);
    } else {
      byPrefix.set(hit.prefix, [hit]);
    }
  }

  await Promise.all(
    [...byPrefix].map(async ([prefix, prefixHits]) => {
      const response = await fetchFirstHost(
        (host) =>
          `${host}/${encodeURIComponent(prefix)}.json` +
          `?icons=${prefixHits.map((h) => encodeURIComponent(h.name)).join(',')}`,
      );
      const payload = (await response.json()) as {
        width?: number;
        height?: number;
        icons?: Record<string, { body?: string } | undefined>;
      };
      const width = payload.width ?? 24;
      const height = payload.height ?? 24;
      const viewBox = {
        width: width > 0 ? width : 24,
        height: height > 0 ? height : 24,
      };
      for (const hit of prefixHits) {
        const body = payload.icons?.[hit.name]?.body;
        if (typeof body !== 'string') {
          continue;
        }
        previews.set(hit.key, {
          paths: namesItsOwnColour(body) ? null : iconPathsFromBody(body),
          viewBox,
        });
      }
    }),
  ).catch(() => {
    // A set that cannot be reached leaves its hits un-previewed; the rows still
    // render, and the tap still resolves the icon for real.
  });

  return previews;
}

/**
 * Whether a body paints any of its paths in a colour of its own.
 *
 * The check is on the **value**, not on the presence of the attribute: a
 * `fill="currentColor"` (or `stroke="none"`, or no paint attribute at all) takes
 * the design's ink and is exactly what this feature wants. Only a literal colour
 * — a hex, an `rgb()`, or a named CSS colour — makes the icon un-inkable.
 *
 * Getting this wrong in either direction is costly: too loose and a coloured
 * emoji renders monochrome, too strict and whole monotone sets become impossible
 * to import.
 */
function namesItsOwnColour(body: string): boolean {
  const values = body.matchAll(
    /\b(?:fill|stroke)\s*[:=]\s*["']?([^"'\s/>;]+)/gi,
  );
  for (const [, value] of values) {
    const v = value.toLowerCase();
    if (v === 'currentcolor' || v === 'none' || v === 'inherit' || v === '') {
      continue;
    }
    // A hex, an rgb()/hsl() function, or a bare colour word.
    if (
      /^#[0-9a-f]{3,8}$/.test(v) ||
      /^(rgb|hsl)a?\(/.test(v) ||
      /^[a-z]+$/.test(v)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Fetch one icon and resolve it to paths.
 *
 * `null` means the icon cannot be represented as ink: a palette set, a body with
 * elements the resolver refuses, or **a body whose paths carry their own `fill`**
 * (a coloured icon inside an otherwise monotone set). All three would draw
 * something other than what the user picked, so all three are refused.
 *
 * Throws only when no host answers.
 */
export async function fetchIcon(
  hit: Pick<IconSearchHit, 'prefix' | 'name'>,
): Promise<FetchedIcon | null> {
  const response = await fetchFirstHost(
    (host) =>
      `${host}/${encodeURIComponent(hit.prefix)}.json` +
      `?icons=${encodeURIComponent(hit.name)}`,
  );
  const payload = (await response.json()) as {
    width?: number;
    height?: number;
    icons?: Record<string, { body?: string } | undefined>;
  };
  const body = payload.icons?.[hit.name]?.body;
  if (typeof body !== 'string') {
    return null;
  }
  // A path that names its **own colour** would render in that colour, not the
  // design's ink — so it is refused. The search response's `palette` flag is the
  // usual guard, but it describes the *set*, and this describes the icon being
  // imported.
  //
  // `currentColor` and `none` are not colours: they are the two tokens that mean
  // "the ink you were given" and "no paint", and they are how nearly every
  // monotone set marks its paths (`fill="currentColor"`, and Tabler's
  // `fill="none" stroke="currentColor"`). Refusing those rejects whole sets of
  // perfectly inked icons, which is what an over-broad version of this test did.
  if (namesItsOwnColour(body)) {
    return null;
  }
  const paths = iconPathsFromBody(body);
  if (!paths) {
    return null;
  }
  // A set that omits the box is 24×24 by convention; Iconify's own metadata says
  // so and the response leaves it out when it matches the default.
  const width = payload.width ?? 24;
  const height = payload.height ?? 24;
  return {
    paths,
    viewBox: {
      width: width > 0 ? width : 24,
      height: height > 0 ? height : 24,
    },
  };
}
