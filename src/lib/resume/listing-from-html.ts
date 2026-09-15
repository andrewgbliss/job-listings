import type { JobListing } from "./from-job-listing";

const DESCRIPTION_LIMIT = 20_000;
const GENERIC_EMPLOYER = /^(inc|llc|ltd|corp|company|the company)$/i;
const LINKEDIN_JOB_ID = /\d{8,}/;

function asArray<T>(value: T | Array<T> | undefined): Array<T> {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stringNames(value: unknown): Array<string> {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length >= 3 ? [trimmed] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(stringNames);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return [
      ...stringNames(record.name),
      ...stringNames(record.legalName),
      ...stringNames(record.alternateName),
      ...stringNames(record.brand),
    ];
  }
  return [];
}

function uniqueEmployerNames(names: Array<string>): Array<string> {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))]
    .filter((name) => name.length >= 3 && !GENERIC_EMPLOYER.test(name))
    .sort((a, b) => b.length - a.length);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactEmployerNames(text: string, names: Array<string>): string {
  let out = text;
  for (const name of uniqueEmployerNames(names)) {
    out = out.replace(new RegExp(escapeRegExp(name), "gi"), "the company");
  }
  return out.replace(/\s+/g, " ").trim();
}

function redactEmployerFromTitle(title: string, names: Array<string>): string {
  let out = title;
  for (const name of uniqueEmployerNames(names)) {
    const escaped = escapeRegExp(name);
    out = out.replace(new RegExp(`\\s+[-–—|@]\\s*${escaped}.*$`, "i"), "");
    out = out.replace(new RegExp(`\\s+(?:at|@)\\s+${escaped}.*$`, "i"), "");
    out = out.replace(new RegExp(escaped, "gi"), "");
  }
  return out.replace(/\s+/g, " ").trim();
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
  if (typeof data !== "object") {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  const types = asArray(record["@type"]).map(String);
  if (types.includes("JobPosting")) {
    return record;
  }
  if (record["@graph"]) {
    return findJobPosting(record["@graph"]);
  }
  return undefined;
}

function listingFromJobPosting(
  posting: Record<string, unknown>,
  url: string,
): Partial<JobListing> {
  const skills = asArray(posting.skills)
    .flatMap((skill) => String(skill).split(/[,/|]/))
    .map((skill) => skill.trim())
    .filter(Boolean);

  return {
    url,
    title: posting.title ? String(posting.title) : undefined,
    description: posting.description ? stripHtml(String(posting.description)) : "",
    skills,
  };
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

function firstHeading(html: string): string {
  const match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? stripHtml(match[1]) : "";
}

function textNearClass(html: string, classPart: string, limit = DESCRIPTION_LIMIT): string {
  const pattern = new RegExp(
    `class=["'][^"']*${escapeRegExp(classPart)}[^"']*["'][^>]*>`,
    "i",
  );
  const open = html.search(pattern);
  if (open < 0) {
    return "";
  }
  const start = html.indexOf(">", open);
  if (start < 0) {
    return "";
  }
  return stripHtml(html.slice(start + 1, start + 1 + 80_000)).slice(0, limit);
}

function employerNamesFromHtml(html: string): Array<string> {
  const classParts = [
    "job-details-jobs-unified-top-card__company-name",
    "jobs-unified-top-card__company-name",
    "topcard__org-name-link",
  ];
  return classParts
    .map((part) => textNearClass(html, part, 80).split(/\s{2,}|[|·•]/)[0]?.trim() ?? "")
    .filter((name) => name.length >= 3 && name.length <= 80);
}

function isLinkedInJobId(jobId: string) {
  return LINKEDIN_JOB_ID.test(jobId) && jobId.length <= 16;
}

export function linkedInViewUrl(jobId: string) {
  return `https://www.linkedin.com/jobs/view/${jobId}`;
}

export function isSearchPath(pathname: string) {
  return /\/jobs\/search/i.test(pathname) || /\/jobs\/search-results/i.test(pathname);
}

export function jobUrlsFromHtml(html: string, pageUrl: string): Array<string> {
  const found = new Set<string>();
  const add = (jobId: string | undefined) => {
    if (jobId && isLinkedInJobId(jobId)) {
      found.add(linkedInViewUrl(jobId));
    }
  };

  try {
    const href = new URL(pageUrl);
    add(href.searchParams.get("currentJobId") ?? undefined);
    const view = href.pathname.match(/\/jobs\/view\/(\d+)/);
    add(view?.[1]);
  } catch {
    // Ignore invalid page URLs; still scan the HTML.
  }

  for (const match of html.matchAll(
    /data-occludable-job-id=["'](\d+)["']/gi,
  )) {
    add(match[1]);
  }
  for (const match of html.matchAll(/data-job-id=["'](\d+)["']/gi)) {
    add(match[1]);
  }
  for (const match of html.matchAll(/jobPosting:(\d+)/g)) {
    add(match[1]);
  }
  for (const match of html.matchAll(/\/jobs\/view\/(\d+)/g)) {
    add(match[1]);
  }
  for (const match of html.matchAll(/currentJobId=(\d+)/g)) {
    add(match[1]);
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

  const view = href.pathname.match(/\/jobs\/view\/(\d+)/);
  if (view?.[1] && isLinkedInJobId(view[1])) {
    return { url: linkedInViewUrl(view[1]) };
  }

  const currentJobId = href.searchParams.get("currentJobId");
  if (currentJobId && isLinkedInJobId(currentJobId)) {
    return {
      url: linkedInViewUrl(currentJobId),
      searchUrl: isSearchPath(href.pathname) ? href.toString() : undefined,
    };
  }

  return { url: href.toString() };
}

export function listingLooksLikeAJob(listing: JobListing) {
  const text = `${listing.title ?? ""} ${listing.description ?? ""}`.toLowerCase();
  if (/sign in|join now|log in to continue|authwall/i.test(text) && !listing.title) {
    return false;
  }
  const hints = [
    "job",
    "role",
    "engineer",
    "developer",
    "responsibilities",
    "requirements",
    "qualifications",
    "we're hiring",
    "we are hiring",
  ];
  return hints.some((hint) => text.includes(hint)) && (listing.description?.length ?? 0) > 80;
}

export function listingFromHtml(
  html: string,
  pageUrl: string,
  searchUrl?: string,
): JobListing {
  const canonical = canonicalJobUrl(pageUrl);
  const url = canonical.url;
  const employerNames = employerNamesFromHtml(html);
  const classDescription =
    textNearClass(html, "show-more-less-html__markup") ||
    textNearClass(html, "jobs-description") ||
    textNearClass(html, "job-details") ||
    textNearClass(html, "job-description");

  let listing: JobListing = {
    url,
    title: firstHeading(html) || undefined,
    description: (classDescription || stripHtml(html)).slice(0, DESCRIPTION_LIMIT),
    skills: [],
    searchUrl: searchUrl || canonical.searchUrl,
  };

  for (const block of extractJsonLdBlocks(html)) {
    try {
      const posting = findJobPosting(JSON.parse(block));
      if (!posting) {
        continue;
      }
      employerNames.push(
        ...stringNames(posting.hiringOrganization),
        ...stringNames(posting.employmentUnit),
      );
      const fromLd = listingFromJobPosting(posting, url);
      listing = {
        ...listing,
        ...fromLd,
        description: fromLd.description || listing.description,
        title: fromLd.title || listing.title,
        searchUrl: listing.searchUrl,
      };
      break;
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  }

  if (listing.title) {
    listing.title = redactEmployerFromTitle(listing.title, employerNames) || listing.title;
  }
  if (listing.description) {
    listing.description = redactEmployerNames(listing.description, employerNames);
  }
  return listing;
}
