import type { JobListing } from "../from-job-listing";
import { escapeRegExp, stripHtml } from "../html";
import type { ScrapeStrategy } from "./types";

const DESCRIPTION_LIMIT = 20_000;
const GENERIC_EMPLOYER = /^(inc|llc|ltd|corp|company|the company)$/i;
const JOB_PATH = /^\/jobs\/(\d+)-([a-z0-9-]+)(?:\/|$)/i;
const LISTING_TITLE =
  /^(current (?:job )?(?:openings|opportunities)|career opportunities|jobs|careers|join the team)$/i;

function asArray<T>(value: T | Array<T> | undefined): Array<T> {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function extractJsonLdBlocks(html: string): Array<string> {
  const blocks: Array<string> = [];
  const pattern =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    if (match[1]?.trim()) {
      blocks.push(match[1].trim());
    }
  }
  return blocks;
}

function findJobPosting(data: unknown): Record<string, unknown> | undefined {
  if (!data) {
    return undefined;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findJobPosting(item);
      if (found) {
        return found;
      }
    }
    return undefined;
  }
  const record = asRecord(data);
  if (!record) {
    return undefined;
  }
  const types = asArray(record["@type"]).map(String);
  if (types.includes("JobPosting")) {
    return record;
  }
  if (record["@graph"]) {
    return findJobPosting(record["@graph"]);
  }
  return undefined;
}

function jobPostingFromHtml(html: string): Record<string, unknown> | undefined {
  for (const block of extractJsonLdBlocks(html)) {
    try {
      const posting = findJobPosting(JSON.parse(block));
      if (posting) {
        return posting;
      }
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  }
  return undefined;
}

function decodeEntities(value: string) {
  let previous = "";
  let out = value;
  while (out !== previous) {
    previous = out;
    out = out
      .replace(/&nbsp;/gi, " ")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&amp;/gi, "&");
  }
  return out;
}

function firstHeading(html: string): string {
  const match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? stripHtml(match[1]) : "";
}

function uniqueEmployerNames(names: Array<string>): Array<string> {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))]
    .filter((name) => name.length >= 3 && !GENERIC_EMPLOYER.test(name))
    .sort((a, b) => b.length - a.length);
}

function firstEmployerName(names: Array<string>): string | undefined {
  return names
    .map((name) => name.replace(/\s+/g, " ").trim())
    .find(
      (name) =>
        name.length >= 2 && name.length <= 80 && !GENERIC_EMPLOYER.test(name),
    );
}

function redactEmployerNames(text: string, names: Array<string>): string {
  let out = text;
  for (const name of uniqueEmployerNames(names)) {
    out = out.replace(new RegExp(escapeRegExp(name), "gi"), "the company");
  }
  return out.replace(/\s+/g, " ").trim();
}

function organizationName(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length >= 2 ? trimmed : undefined;
  }
  const record = asRecord(value);
  if (typeof record?.name === "string") {
    const trimmed = record.name.trim();
    return trimmed.length >= 2 ? trimmed : undefined;
  }
  return undefined;
}

function jobPathFromUrl(url: string) {
  try {
    const href = new URL(url);
    const match = href.pathname.match(JOB_PATH);
    if (match?.[1] && match[2]) {
      return { jobId: match[1], slug: match[2] };
    }
  } catch {
    // Ignore invalid URLs.
  }
  return undefined;
}

function cleanTitle(title: string | undefined): string | undefined {
  const trimmed = (title ?? "")
    .replace(/\s*[-|]\s*GoEngineer\s*$/i, "")
    .split("|")[0]
    .replace(/\s+/g, " ")
    .trim();
  if (!trimmed || trimmed.length < 4 || trimmed.length > 120) {
    return undefined;
  }
  if (LISTING_TITLE.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function jobBodyFromHtml(html: string): string {
  const heading = html.search(/<h1\b[^>]*>/i);
  if (heading < 0) {
    return "";
  }
  const start = html.indexOf(">", heading);
  if (start < 0) {
    return "";
  }
  const slice = html.slice(start + 1);
  const end = slice.search(/\b(?:About GoEngineer|Footer)\b/i);
  const body = end >= 0 ? slice.slice(0, end) : slice.slice(0, 80_000);
  return stripHtml(body).slice(0, DESCRIPTION_LIMIT);
}

function postingDescription(posting: Record<string, unknown> | undefined) {
  if (typeof posting?.description !== "string") {
    return "";
  }
  return stripHtml(decodeEntities(posting.description));
}

export function goengineerJobUrl(jobId: string, slug: string) {
  return `https://careers.goengineer.com/jobs/${jobId}-${slug}`;
}

export function isSearchPath(pathname: string) {
  return pathname === "/" || /^\/jobs\/?$/i.test(pathname);
}

export function jobUrlsFromHtml(html: string, pageUrl: string): Array<string> {
  const found = new Set<string>();
  const add = (jobId: string | undefined, slug: string | undefined) => {
    if (jobId && slug) {
      found.add(goengineerJobUrl(jobId, slug));
    }
  };

  const current = jobPathFromUrl(pageUrl);
  add(current?.jobId, current?.slug);

  for (const match of html.matchAll(/\/jobs\/(\d+)-([a-z0-9-]+)/gi)) {
    add(match[1], match[2]);
  }

  return [...found];
}

export function canonicalJobUrl(pageUrl: string): {
  url: string;
  searchUrl?: string;
} {
  let href: URL;
  try {
    href = new URL(pageUrl);
  } catch {
    return { url: pageUrl };
  }

  const job = jobPathFromUrl(pageUrl);
  if (job) {
    return { url: goengineerJobUrl(job.jobId, job.slug) };
  }

  return {
    url: href.toString(),
    searchUrl: isSearchPath(href.pathname) ? href.toString() : undefined,
  };
}

export function listingLooksLikeAJob(listing: JobListing) {
  const description = listing.description ?? "";
  const jobView = /\/jobs\/\d+-[a-z0-9-]+/i.test(listing.url);
  return jobView && Boolean(listing.title) && description.length > 80;
}

export function listingFromHtml(
  html: string,
  pageUrl: string,
  searchUrl?: string,
): JobListing {
  const canonical = canonicalJobUrl(pageUrl);
  const url = canonical.url;
  const posting = jobPostingFromHtml(html);
  const postingCompany = organizationName(posting?.hiringOrganization);
  const employerNames = postingCompany ? [postingCompany] : ["GoEngineer"];
  const title =
    cleanTitle(firstHeading(html)) ||
    cleanTitle(typeof posting?.title === "string" ? posting.title : undefined);
  const description = redactEmployerNames(
    (
      postingDescription(posting) ||
      jobBodyFromHtml(html) ||
      stripHtml(html)
    ).slice(0, DESCRIPTION_LIMIT),
    employerNames,
  );

  return {
    url,
    title,
    description,
    company: firstEmployerName(employerNames),
    skills: [],
    searchUrl: searchUrl || canonical.searchUrl,
  };
}

export function isGoEngineerUrl(url: string) {
  try {
    return (
      new URL(url).hostname.replace(/^www\./, "") === "careers.goengineer.com"
    );
  } catch {
    return /careers\.goengineer\.com/i.test(url);
  }
}

export const goengineerStrategy: ScrapeStrategy = {
  id: "goengineer",
  matches: isGoEngineerUrl,
  listingFromHtml,
  jobUrlsFromHtml,
  canonicalJobUrl,
  listingLooksLikeAJob,
};
