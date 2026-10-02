import path from "node:path";
import { searchStoreRelativePath } from "./types";

export function searchStoreAbsPath(cwd = process.cwd()) {
  return path.join(cwd, ...searchStoreRelativePath.split("/"));
}

export function queryCachePath(slug: string, cwd = process.cwd()) {
  return path.join(searchStoreAbsPath(cwd), "queries", `${slug}.json`);
}

export function sourceCachePath(key: string, cwd = process.cwd()) {
  return path.join(searchStoreAbsPath(cwd), "sources", `${key}.json`);
}

export function rateLimitPath(cwd = process.cwd()) {
  return path.join(searchStoreAbsPath(cwd), "rate-limit.json");
}

export function querySlug(normalized: string) {
  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "query";
}

/** Same keywords with a different zip are a separate saved search. */
export function searchSlug(normalized: string, zip = "") {
  const base = querySlug(normalized);
  return zip ? `${base}-${zip}` : base;
}

export function zipCachePath(zip: string, cwd = process.cwd()) {
  return path.join(searchStoreAbsPath(cwd), "zips", `${zip}.json`);
}

/** US ZIP or ZIP+4. Empty is allowed. Invalid text returns null. */
export function normalizeZip(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const match = trimmed.match(/^(\d{5})(?:-\d{4})?$/);
  return match?.[1] ?? null;
}

export function normalizeQuery(query: string) {
  return query
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
