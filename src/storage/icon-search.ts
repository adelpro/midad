import { iconPathsFromBody, type IconPath } from '@/editor/icons/icon-geometry';
import {
  ICONIFY_HOSTS,
  ICON_SEARCH_LIMIT,
  iconSearchUrl,
  isAllowedPrefix,
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
 * path to render instead of a silently empty list. `fetchIcon` returns `null`
 * for an icon that cannot be represented (a palette icon, a body with elements
 * the resolver refuses) — that is a property of the icon, not a failure, and the
 * picker shows it as unavailable with a reason.
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

  return icons
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
        setName: collection?.name ?? parsed.prefix,
        // An absent `collections` entry means the response drifted from the
        // documented shape; treating it as palette-bearing is the safe default,
        // because that only ever disables a row rather than letting an
        // un-inkable icon through.
        palette: collection ? collection.palette === true : true,
        allowed: isAllowedPrefix(parsed.prefix),
      };
    })
    .filter((hit): hit is IconSearchHit => hit !== null);
}

/**
 * Fetch one icon and resolve it to paths.
 *
 * `null` means the icon cannot be represented — a palette set, or a body with
 * elements the resolver refuses. That is a property of the icon, not a failure.
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
