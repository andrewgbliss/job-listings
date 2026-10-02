export const searchHref = "/resume/search" as const;

/** Reuse a keyword search for this long before calling the feeds again. */
export const QUERY_TTL_MS = 12 * 60 * 60 * 1000;

/** Reuse a downloaded feed snapshot for this long across keywords. */
export const SOURCE_TTL_MS = 6 * 60 * 60 * 1000;

export const MIN_HOST_GAP_MS = 2_000;
export const MIN_GLOBAL_GAP_MS = 1_000;

export const MAX_RESULTS = 80;
export const DESCRIPTION_LIMIT = 1_200;

export const searchStoreRelativePath =
  "src/lib/job-listings/utils/search/store";

export type SearchListing = {
  id: string;
  source: string;
  sourceLabel: string;
  title: string;
  company: string;
  url: string;
  location?: string;
  publishedAt?: string;
  salary?: string;
  tags: Array<string>;
  description: string;
};

export type SourceStatus = {
  id: string;
  label: string;
  creditUrl: string;
  ok: boolean;
  fromCache: boolean;
  fetchedAt?: string;
  matchCount: number;
  error?: string;
  note?: string;
};

export type ManualSearchLink = {
  label: string;
  url: string;
};

export type ZipPlace = {
  zip: string;
  city: string;
  state: string;
  stateAbbr: string;
};

export type SearchResult = {
  query: string;
  normalized: string;
  zip?: string;
  place?: ZipPlace;
  fetchedAt: string;
  expiresAt: string;
  fromCache: boolean;
  cacheFile: string;
  listings: Array<SearchListing>;
  sources: Array<SourceStatus>;
  manualLinks: Array<ManualSearchLink>;
};

export type RecentSearch = {
  query: string;
  normalized: string;
  zip?: string;
  fetchedAt: string;
  expiresAt: string;
  listingCount: number;
  cacheFile: string;
};

export type StoredSearch = Omit<SearchResult, "fromCache">;
