import type { JobListing } from "../from-job-listing";
import { escapeRegExp, stripHtml } from "../html";
import type { ScrapeStrategy } from "./types";

const DESCRIPTION_LIMIT = 20_000;
const KSL_LISTING_ID = /\d{5,}/;
const GENERIC_EMPLOYER = /^(inc|llc|ltd|corp|company|the company)$/i;
const PERSON_NAME =
  /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$/;

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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function productFromJsonLd(html: string): Record<string, unknown> | undefined {
  for (const block of extractJsonLdBlocks(html)) {
    try {
      const parsed: unknown = JSON.parse(block);
      const record = asRecord(parsed);
      if (record && String(record["@type"]) === "Product") {
        return record;
      }
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  }
  return undefined;
}

function firstHeading(html: string): string {
  const match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? stripHtml(match[1]) : "";
}

function unescapeJsonString(value: string) {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value.replaceAll("\\u0026", "&");
  }
}

function ogTitle(html: string): string {
  const meta = html.match(
    /property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
  );
  if (meta?.[1]) {
    return stripHtml(meta[1]);
  }
  const rsc = html.match(/"og:title"[^[\]]*"content":"((?:\\.|[^"\\])*)"/i);
  if (rsc?.[1]) {
    return stripHtml(unescapeJsonString(rsc[1]));
  }
  return "";
}

function cleanTitle(title: string | undefined): string | undefined {
  const trimmed = (title ?? "")
    .replace(/\s*\|\s*KSL Classifieds\s*$/i, "")
    .split("|")[0]
    .replace(/\s+/g, " ")
    .trim();
  if (!trimmed || trimmed.length < 4 || trimmed.length > 120) {
    return undefined;
  }
  return trimmed;
}

function jobBodyFromHtml(html: string): string {
  const heading = html.search(/<h2\b[^>]*>\s*Job Description\s*<\/h2>/i);
  if (heading < 0) {
    return "";
  }
  const start = html.indexOf(">", heading);
  if (start < 0) {
    return "";
  }
  const slice = html.slice(start + 1);
  const end = slice.search(
    /\b(?:Page Stats|Flag this Listing|Safe\.\s*Simple\.\s*Trusted)\b/i,
  );
  const body = end >= 0 ? slice.slice(0, end) : slice.slice(0, 80_000);
  return stripHtml(body)
    .replace(/^(?:Job Description\s*)+/i, "")
    .slice(0, DESCRIPTION_LIMIT);
}

function isPersonName(name: string) {
  return PERSON_NAME.test(name.trim());
}

function firstCompanyName(names: Array<string>): string | undefined {
  return names
    .map((name) => name.replace(/\s+/g, " ").trim())
    .find(
      (name) =>
        name.length >= 2 &&
        name.length <= 80 &&
        !GENERIC_EMPLOYER.test(name) &&
        !isPersonName(name),
    );
}

function uniqueEmployerNames(names: Array<string>): Array<string> {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))]
    .filter(
      (name) =>
        name.length >= 3 &&
        !GENERIC_EMPLOYER.test(name) &&
        !isPersonName(name),
    )
    .sort((a, b) => b.length - a.length);
}

function companyFromDescription(text: string): Array<string> {
  const names: Array<string> = [];
  const seeking = text.match(
    /\b([A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){0,4})\s+is (?:seeking|hiring|looking to hire|looking for)\b/,
  );
  if (seeking?.[1]) {
    names.push(seeking[1]);
  }
  const operates = text.match(
    /\b([A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){0,4})\s+operates\b/,
  );
  if (operates?.[1]) {
    names.push(operates[1]);
  }
  return names;
}

function sellerNameFromProduct(
  product: Record<string, unknown> | undefined,
): string | undefined {
  const offers = asRecord(product?.offers);
  const seller = asRecord(offers?.seller);
  return typeof seller?.name === "string" ? seller.name.trim() : undefined;
}

function redactEmployerNames(text: string, names: Array<string>): string {
  let out = text;
  for (const name of uniqueEmployerNames(names)) {
    out = out.replace(new RegExp(escapeRegExp(name), "gi"), "the company");
  }
  return out.replace(/\s+/g, " ").trim();
}

function isKslListingId(jobId: string) {
  return KSL_LISTING_ID.test(jobId) && jobId.length <= 16;
}

export function kslListingUrl(jobId: string) {
  return `https://classifieds.ksl.com/listing/${jobId}`;
}

export function isSearchPath(pathname: string) {
  return /\/search/i.test(pathname);
}

export function jobUrlsFromHtml(html: string, pageUrl: string): Array<string> {
  const found = new Set<string>();
  const add = (jobId: string | undefined) => {
    if (jobId && isKslListingId(jobId)) {
      found.add(kslListingUrl(jobId));
    }
  };

  try {
    const href = new URL(pageUrl);
    const listing = href.pathname.match(/\/listing\/(\d+)/);
    add(listing?.[1]);
  } catch {
    // Ignore invalid page URLs; still scan the HTML.
  }

  for (const match of html.matchAll(/\/listing\/(\d+)/g)) {
    add(match[1]);
  }
  for (const match of html.matchAll(/data-item-id=["'](\d+)["']/gi)) {
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

  const listing = href.pathname.match(/\/listing\/(\d+)/);
  if (listing?.[1] && isKslListingId(listing[1])) {
    return { url: kslListingUrl(listing[1]) };
  }

  return {
    url: href.toString(),
    searchUrl: isSearchPath(href.pathname) ? href.toString() : undefined,
  };
}

export function listingLooksLikeAJob(listing: JobListing) {
  const description = listing.description ?? "";
  const text = `${listing.title ?? ""} ${description}`.toLowerCase();
  const jobView = /\/listing\/\d{5,}/i.test(listing.url);
  const hasJobBody =
    Boolean(listing.title) &&
    (description.length > 200 ||
      /\b(job description|responsibilities|qualifications|we're hiring|we are hiring|seeking an? |full-time|years of experience)\b/i.test(
        text,
      ));
  if (hasJobBody) {
    return true;
  }
  return jobView && description.length > 80;
}

export function listingFromHtml(
  html: string,
  pageUrl: string,
  searchUrl?: string,
): JobListing {
  const canonical = canonicalJobUrl(pageUrl);
  const url = canonical.url;
  const product = productFromJsonLd(html);
  const jobBody = jobBodyFromHtml(html);
  const seller = sellerNameFromProduct(product);
  const employerNames = [
    ...companyFromDescription(jobBody),
    ...(seller ? [seller] : []),
  ];
  const company = firstCompanyName(employerNames);
  const title =
    cleanTitle(firstHeading(html)) ||
    cleanTitle(typeof product?.name === "string" ? product.name : undefined) ||
    cleanTitle(ogTitle(html));
  const description = redactEmployerNames(
    (jobBody ||
      (typeof product?.description === "string" ? product.description : "") ||
      stripHtml(html)
    ).slice(0, DESCRIPTION_LIMIT),
    employerNames,
  );

  return {
    url,
    title,
    description,
    company,
    skills: [],
    searchUrl: searchUrl || canonical.searchUrl,
  };
}

export function isKslUrl(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "ksl.com" || host.endsWith(".ksl.com");
  } catch {
    return /ksl\.com/i.test(url);
  }
}

export const kslStrategy: ScrapeStrategy = {
  id: "ksl",
  matches: isKslUrl,
  listingFromHtml,
  jobUrlsFromHtml,
  canonicalJobUrl,
  listingLooksLikeAJob,
};
