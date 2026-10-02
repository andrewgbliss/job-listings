import path from "node:path";
import {
  queryCacheCurrent,
  readQueryCache,
  readSourceSnapshot,
  writeQueryCache,
  writeSourceSnapshot,
} from "./cache";
import { normalizeQuery, normalizeZip, queryCachePath, searchSlug } from "./paths";
import { withSearchLock } from "./rate-limit";
import { feedSources, listingFitsPlace, listingMatches, manualSearchLinks } from "./sources";
import {
  MAX_RESULTS,
  QUERY_TTL_MS,
  type SearchListing,
  type SearchResult,
  type SourceStatus,
  type StoredSearch,
  type ZipPlace,
} from "./types";
import { lookupZip } from "./zip";

const PARTIAL_TTL_MS = 15 * 60 * 1000;

export class SearchError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function dedupeKey(url: string) {
  try {
    const href = new URL(url);
    return `${href.hostname.replace(/^www\./, "")}${href.pathname}`
      .replace(/\/$/, "")
      .toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function sortListings(listings: Array<SearchListing>) {
  return [...listings].sort((a, b) => {
    const left = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const right = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return (Number.isNaN(right) ? 0 : right) - (Number.isNaN(left) ? 0 : left);
  });
}

function relativeCacheFile(normalized: string, zip: string) {
  return path
    .relative(process.cwd(), queryCachePath(searchSlug(normalized, zip)))
    .replaceAll("\\", "/");
}

function keepListing(
  item: SearchListing,
  normalized: string,
  place?: ZipPlace,
) {
  return listingMatches(item, normalized) && listingFitsPlace(item, place);
}

async function loadSource(
  source: (typeof feedSources)[number],
  normalized: string,
  place?: ZipPlace,
): Promise<{ listings: Array<SearchListing>; status: SourceStatus }> {
  const key = source.cacheKey(normalized).replace(/[^a-z0-9-]+/g, "-");
  const cached = await readSourceSnapshot(key);
  if (cached) {
    const matches = cached.listings.filter((item) =>
      keepListing(item, normalized, place),
    );
    return {
      listings: matches,
      status: {
        id: source.id,
        label: source.label,
        creditUrl: source.creditUrl,
        ok: true,
        fromCache: true,
        fetchedAt: cached.fetchedAt,
        matchCount: matches.length,
        note: source.note,
      },
    };
  }

  try {
    const listings = await source.load(normalized);
    const fetchedAt = new Date().toISOString();
    await writeSourceSnapshot(key, {
      id: source.id,
      fetchedAt,
      listings,
    });
    const matches = listings.filter((item) => keepListing(item, normalized, place));
    return {
      listings: matches,
      status: {
        id: source.id,
        label: source.label,
        creditUrl: source.creditUrl,
        ok: true,
        fromCache: false,
        fetchedAt,
        matchCount: matches.length,
        note: source.note,
      },
    };
  } catch (error) {
    return {
      listings: [],
      status: {
        id: source.id,
        label: source.label,
        creditUrl: source.creditUrl,
        ok: false,
        fromCache: false,
        matchCount: 0,
        error: error instanceof Error ? error.message : "Request failed",
        note: source.note,
      },
    };
  }
}

async function collect(
  normalized: string,
  query: string,
  zip: string,
): Promise<StoredSearch> {
  const place = zip ? await lookupZip(zip) : undefined;
  const seen = new Set<string>();
  const listings: Array<SearchListing> = [];
  const sources: Array<SourceStatus> = [];

  for (const source of feedSources) {
    const loaded = await loadSource(source, normalized, place);
    sources.push(loaded.status);
    for (const item of loaded.listings) {
      const key = dedupeKey(item.url);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      listings.push(item);
    }
  }

  const fetchedAt = new Date().toISOString();
  const complete = sources.every((source) => source.ok);
  return {
    query,
    normalized,
    zip: zip || undefined,
    place,
    fetchedAt,
    expiresAt: new Date(
      Date.now() + (complete ? QUERY_TTL_MS : PARTIAL_TTL_MS),
    ).toISOString(),
    cacheFile: relativeCacheFile(normalized, zip),
    listings: sortListings(listings).slice(0, MAX_RESULTS),
    sources,
    manualLinks: manualSearchLinks(query, zip),
  };
}

async function runLocked(
  query: string,
  zip: string,
  refresh: boolean,
): Promise<SearchResult> {
  const normalized = normalizeQuery(query);
  if (!refresh) {
    const cached = await readQueryCache(normalized, zip);
    if (cached && queryCacheCurrent(cached.expiresAt)) {
      return {
        ...cached,
        fromCache: true,
        manualLinks: manualSearchLinks(query.trim(), zip),
      };
    }
  }

  const stored = await collect(normalized, query.trim(), zip);
  await writeQueryCache(stored);
  return { ...stored, fromCache: false };
}

export async function runJobSearch(
  query: string,
  options: { refresh?: boolean; zip?: string } = {},
): Promise<SearchResult> {
  const normalized = normalizeQuery(query);
  if (normalized.length < 2) {
    throw new SearchError("Enter at least 2 characters.");
  }
  const zip = normalizeZip(options.zip ?? "");
  if (zip == null) {
    throw new SearchError("Enter a 5-digit zip code.");
  }

  if (!options.refresh) {
    const cached = await readQueryCache(normalized, zip);
    if (cached && queryCacheCurrent(cached.expiresAt)) {
      return {
        ...cached,
        fromCache: true,
        zip: zip || undefined,
        manualLinks: manualSearchLinks(query.trim(), zip),
      };
    }
  }

  return withSearchLock(() => runLocked(query, zip, Boolean(options.refresh)));
}
