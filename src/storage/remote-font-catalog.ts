/**
 * Remote font catalog — fetch, normalise and search the Fontsource directory
 * (`api.fontsource.org/v1/fonts`, ~2100 families), the CORS-open mirror of
 * `github.com/google/fonts` that the remote-font feature downloads from.
 * Native and web share one code path here (both can fetch the API directly).
 *
 * The raw JSON is cached in AsyncStorage and refreshed at most once a week, so
 * search keeps working offline after the first successful fetch.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  normalizeRemoteFontId,
  type RemoteFontFamily,
} from '@/theme/remote-fonts';

const FONTSOURCE_CATALOG_URL = 'https://api.fontsource.org/v1/fonts';

const CATALOG_KEY = 'midad:remote-font-catalog:v1';
/** Refresh the catalog at most once a week. */
const CATALOG_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CachedCatalog {
  families: RemoteFontFamily[];
  fetchedAt: number;
}

/** The shape Fontsource actually sends; everything optional so shape drift degrades, not crashes. */
interface RawFontsourceFamily {
  id?: string;
  family?: string;
  subsets?: string[];
  weights?: number[];
  styles?: string[];
  defSubset?: string;
  variable?: boolean;
  category?: string | null;
  license?: string;
  type?: string;
}

function normalize(raw: RawFontsourceFamily): RemoteFontFamily | null {
  // Only Google Fonts faces are offered — the directory also lists icon fonts.
  if (typeof raw.type !== 'string' || raw.type !== 'google') {
    return null;
  }
  const family = raw.family ?? raw.id ?? 'Font';
  return {
    id: normalizeRemoteFontId(raw.id ?? raw.family ?? family),
    family,
    subsets: raw.subsets ?? [],
    weights: raw.weights ?? [],
    styles: raw.styles ?? [],
    defSubset: raw.defSubset ?? 'latin',
    variable: raw.variable === true,
    category: raw.category ?? null,
    license: raw.license ?? '',
    type: raw.type,
  };
}

async function readCached(): Promise<CachedCatalog | null> {
  try {
    const raw = await AsyncStorage.getItem(CATALOG_KEY);
    return raw ? (JSON.parse(raw) as CachedCatalog) : null;
  } catch {
    return null;
  }
}

async function writeCached(families: RemoteFontFamily[]): Promise<void> {
  const body: CachedCatalog = { families, fetchedAt: Date.now() };
  try {
    await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify(body));
  } catch {
    // Caching is best-effort — a full catalog is ~200KB and some stores are small.
  }
}

/**
 * The Google Fonts directory (~2100 families), from cache when fresh, otherwise
 * fetched and re-cached. Throws when the network fails and no cache exists yet.
 */
export async function getRemoteFontCatalog(
  refresh = false,
): Promise<RemoteFontFamily[]> {
  const cached = await readCached();
  const freshEnough = cached && Date.now() - cached.fetchedAt < CATALOG_TTL_MS;
  if (cached && (freshEnough || !refresh)) {
    return cached.families;
  }
  try {
    const res = await fetch(FONTSOURCE_CATALOG_URL);
    if (!res.ok) {
      throw new Error(`Fontsource catalog ${res.status}`);
    }
    const raw = (await res.json()) as RawFontsourceFamily[];
    const families = raw
      .map(normalize)
      .filter((f): f is RemoteFontFamily => f !== null);
    await writeCached(families);
    return families;
  } catch (error) {
    if (cached) {
      return cached.families; // stale catalog beats none
    }
    throw error instanceof Error
      ? error
      : new Error(`Fontsource catalog fetch failed: ${String(error)}`);
  }
}

/**
 * Pure search: prefix matches first, then substring matches, capped at `limit`.
 * The caller decides how to surface the Arabic badge (`subsets.includes('arabic')`).
 */
export function filterRemoteFontFamilies(
  families: readonly RemoteFontFamily[],
  query: string,
  limit = 40,
): RemoteFontFamily[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return families.slice(0, limit);
  }
  const prefix: RemoteFontFamily[] = [];
  const contains: RemoteFontFamily[] = [];
  for (const family of families) {
    const name = family.family.toLowerCase();
    if (name.startsWith(q)) {
      prefix.push(family);
    } else if (name.includes(q)) {
      contains.push(family);
    }
  }
  return [...prefix, ...contains].slice(0, limit);
}
