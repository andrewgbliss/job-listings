import fs from "node:fs/promises";
import path from "node:path";
import { queryCachePath, searchSlug, searchStoreAbsPath, sourceCachePath } from "./paths";
import type { RecentSearch, SearchListing, StoredSearch } from "./types";
import { SOURCE_TTL_MS } from "./types";

type SourceSnapshot = {
  id: string;
  fetchedAt: string;
  listings: Array<SearchListing>;
};

async function readJson(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(tmp, filePath);
}

function isStoredSearch(value: unknown): value is StoredSearch {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Partial<StoredSearch>;
  return (
    typeof record.normalized === "string" &&
    typeof record.fetchedAt === "string" &&
    typeof record.expiresAt === "string" &&
    Array.isArray(record.listings) &&
    Array.isArray(record.sources)
  );
}

export async function readQueryCache(normalized: string, zip = "") {
  try {
    const parsed = await readJson(queryCachePath(searchSlug(normalized, zip)));
    return isStoredSearch(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function writeQueryCache(result: StoredSearch) {
  const filePath = queryCachePath(searchSlug(result.normalized, result.zip ?? ""));
  await writeJson(filePath, result);
  return filePath;
}

export function cacheIsFresh(iso: string | undefined, ttlMs: number) {
  if (!iso) {
    return false;
  }
  const time = Date.parse(iso);
  return !Number.isNaN(time) && Date.now() - time < ttlMs;
}

export function queryCacheCurrent(expiresAt: string) {
  const time = Date.parse(expiresAt);
  return !Number.isNaN(time) && time > Date.now();
}

export async function readSourceSnapshot(key: string) {
  try {
    const parsed: unknown = await readJson(sourceCachePath(key));
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }
    const record = parsed as Partial<SourceSnapshot>;
    if (typeof record.fetchedAt !== "string" || !Array.isArray(record.listings)) {
      return undefined;
    }
    if (!cacheIsFresh(record.fetchedAt, SOURCE_TTL_MS)) {
      return undefined;
    }
    return {
      id: typeof record.id === "string" ? record.id : key,
      fetchedAt: record.fetchedAt,
      listings: record.listings,
    } satisfies SourceSnapshot;
  } catch {
    return undefined;
  }
}

export async function writeSourceSnapshot(key: string, snapshot: SourceSnapshot) {
  await writeJson(sourceCachePath(key), snapshot);
}

export async function listRecentSearches(limit = 12): Promise<Array<RecentSearch>> {
  const dir = path.join(searchStoreAbsPath(), "queries");
  const names = await fs.readdir(dir).catch(() => []);
  const recent: Array<RecentSearch> = [];
  for (const name of names) {
    if (!name.endsWith(".json") || name.endsWith(".tmp")) {
      continue;
    }
    try {
      const parsed = await readJson(path.join(dir, name));
      if (!isStoredSearch(parsed)) {
        continue;
      }
      recent.push({
        query: parsed.query,
        normalized: parsed.normalized,
        zip: parsed.zip,
        fetchedAt: parsed.fetchedAt,
        expiresAt: parsed.expiresAt,
        listingCount: parsed.listings.length,
        cacheFile: path
          .relative(process.cwd(), path.join(dir, name))
          .replaceAll("\\", "/"),
      });
    } catch {
      // Skip a torn or unreadable cache file.
    }
  }
  return recent
    .sort((a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt))
    .slice(0, limit);
}
