import type { JobListing } from "../from-job-listing";
import { escapeRegExp, stripHtml } from "../html";
import type { ScrapeStrategy } from "./types";

const DESCRIPTION_LIMIT = 20_000;
const GENERIC_EMPLOYER = /^(inc|llc|ltd|corp|company|the company)$/i;
const JOB_KEY = /^[a-f0-9]{10,32}$/i;

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

function uniqueEmployerNames(names: Array<string>): Array<string> {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))]
    .filter((name) => name.length >= 2 && !GENERIC_EMPLOYER.test(name))
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

function redactEmployerFromTitle(title: string, names: Array<string>): string {
  let out = title;
  for (const name of uniqueEmployerNames(names)) {
    const escaped = escapeRegExp(name);
    out = out.replace(new RegExp(`\\s+[-–—|]\\s*${escaped}.*$`, "i"), "");
    out = out.replace(new RegExp(escaped, "gi"), "");
  }
  return out.replace(/\s+/g, " ").trim();
}

function isJobKey(value: string | null | undefined): value is string {
  return Boolean(value && JOB_KEY.test(value));
}

function originFromUrl(pageUrl: string) {
  try {
    const href = new URL(pageUrl);
    return `${href.protocol}//${href.host}`;
  } catch {
    return "https://www.indeed.com";
  }
}

export function indeedViewUrl(jobKey: string, origin = "https://www.indeed.com") {
  return `${origin}/viewjob?jk=${jobKey}`;
}

export function isViewPath(pathname: string) {
  return /\/viewjob\/?$/i.test(pathname);
}

export function isSearchPath(pathname: string) {
  return (
    /\/jobs\/?$/i.test(pathname) ||
    /\/m\/jobs\/?$/i.test(pathname) ||
    /-jobs\.html$/i.test(pathname)
  );
}

function jobKeyFromUrl(href: URL): string | undefined {
  const named = isViewPath(href.pathname)
    ? href.searchParams.get("jk")
    : (href.searchParams.get("vjk") ?? href.searchParams.get("jk"));
  return isJobKey(named) ? named : undefined;
}

function textNearId(html: string, id: string, limit = DESCRIPTION_LIMIT): string {
  const pattern = new RegExp(`id=["']${escapeRegExp(id)}["'][^>]*>`, "i");
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

function innerTextByAttr(html: string, attr: string, value: string): string {
  const pattern = new RegExp(
    `<([a-z0-9]+)[^>]*\\b${attr}=["']${escapeRegExp(value)}["'][^>]*>([\\s\\S]*?)</\\1>`,
    "i",
  );
  const match = html.match(pattern);
  return match?.[2] ? stripHtml(match[2]) : "";
}

function firstHeading(html: string): string {
  return (
    innerTextByAttr(html, "data-testid", "jobsearch-JobInfoHeader-title") ||
    stripHtml(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "")
  );
}

function metaContent(html: string, property: string): string {
  const escaped = escapeRegExp(property);
  const named = html.match(
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`,
      "i",
    ),
  );
  const reversed = html.match(
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${escaped}["'][^>]*>`,
      "i",
    ),
  );
  return stripHtml(named?.[1] || reversed?.[1] || "");
}

function titleFromDocument(html: string): string {
  const raw =
    metaContent(html, "og:title") ||
    stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  return raw.replace(/\s*\|\s*Indeed(?:\.com)?\s*$/i, "").trim();
}

function decodeJsonString(value: string) {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value.replaceAll("\\u0026", "&").replaceAll("\\/", "/");
  }
}

function isSerpHeading(title: string) {
  return /\bjobs in\b/i.test(title) || /\b\d[\d,]*\s+jobs\b/i.test(title);
}

function cleanTitle(title: string | undefined, employers: Array<string>): string | undefined {
  let trimmed = redactEmployerFromTitle(
    (title ?? "")
      .replace(/\s*[\|–—-]\s*Indeed(?:\.com)?\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim(),
    employers,
  );
  trimmed = trimmed.replace(/\s*[-–—|]\s*$/g, "").trim();
  if (!trimmed || trimmed.length < 4 || trimmed.length > 120) {
    return undefined;
  }
  if (
    /^(indeed|job search|find jobs|sign in)$/i.test(trimmed) ||
    isSerpHeading(trimmed)
  ) {
    return undefined;
  }
  return trimmed;
}

function jobKeyFromPage(pageUrl: string): string | undefined {
  try {
    return jobKeyFromUrl(new URL(pageUrl));
  } catch {
    return undefined;
  }
}

function sliceAfter(html: string, start: number, max = 3500) {
  if (start < 0) {
    return "";
  }
  const next = html
    .slice(start + 20)
    .search(/id=["']jobTitle-[a-f0-9]{10,32}["']/i);
  const end = next >= 0 ? start + 20 + next : start + max;
  return html.slice(start, Math.min(end, start + max));
}

function titleFromJobCard(html: string, jobKey: string): string {
  const id = `jobTitle-${jobKey}`;
  const byText = html.match(
    new RegExp(`id=["']${id}["'][^>]*>([\\s\\S]*?)</`, "i"),
  );
  const text = byText?.[1] ? stripHtml(byText[1]) : "";
  if (text) {
    return text;
  }
  const byLabel = html.match(
    new RegExp(
      `data-jk=["']${jobKey}["'][^>]*aria-label=["']full details of ([^"']+)["']`,
      "i",
    ),
  );
  return byLabel?.[1]?.trim() ?? "";
}

function titleFromViewPane(html: string, jobKey: string): string {
  const match = html.match(
    /data-testid=["']vj-job-title["'][^>]*>([\s\S]*?)<\/h\d>/i,
  );
  if (!match || match.index == null) {
    return "";
  }
  const around = html.slice(match.index, match.index + 4000);
  if (!around.includes(jobKey)) {
    return "";
  }
  return stripHtml(match[1]);
}

function companyNearJobTitle(html: string, jobKey: string): string {
  const at = html.indexOf(`id="jobTitle-${jobKey}"`);
  const slice = sliceAfter(html, at, 2000);
  const match = slice.match(
    /data-testid=["']company-name["'][^>]*>([\s\S]*?)</i,
  );
  return match?.[1] ? stripHtml(match[1]) : "";
}

function companyFromViewPane(html: string, jobKey: string): string {
  const at = html.indexOf('data-testid="vj-job-title"');
  const slice = html.slice(at, at + 4000);
  if (at < 0 || !slice.includes(jobKey)) {
    return "";
  }
  const label = slice.match(
    /aria-label=["']([^"']+?)\s+\(opens in a new tab\)["']/i,
  );
  return label?.[1] ? stripHtml(label[1]) : "";
}

function jobModelNearKey(html: string, jobKey: string): {
  title?: string;
  company?: string;
} {
  const at = html.indexOf(`viewJobLink":"/viewjob?jk=${jobKey}`);
  if (at < 0) {
    return {};
  }
  const window = html.slice(Math.max(0, at - 900), at);
  const last = (field: string) => {
    const pattern = new RegExp(`"${field}":"((?:\\\\.|[^"\\\\])*)"`, "g");
    let value: string | undefined;
    for (const match of window.matchAll(pattern)) {
      value = match[1];
    }
    return value ? decodeJsonString(value) : undefined;
  };
  return { title: last("title"), company: last("truncatedCompany") };
}

function jobBodyFromHtml(html: string, jobKey?: string): string {
  const fromId =
    textNearId(html, "jobDescriptionText") ||
    innerTextByAttr(html, "data-testid", "jobDescriptionText");
  const paneAt = html.indexOf('data-testid="viewjob-job-content"');
  const pane =
    paneAt >= 0 && (!jobKey || html.slice(paneAt, paneAt + 8000).includes(jobKey) || html.slice(Math.max(0, paneAt - 8000), paneAt).includes(jobKey))
      ? stripHtml(html.slice(paneAt, paneAt + 80_000))
      : "";
  const raw = fromId || pane;
  if (!raw) {
    return "";
  }
  return raw
    .split(
      /\b(?:Report job|People also searched|Similar jobs|Explore related jobs)\b/i,
    )[0]
    .trim()
    .slice(0, DESCRIPTION_LIMIT);
}

function employerNamesFromHtml(html: string): Array<string> {
  const tested = innerTextByAttr(html, "data-testid", "inlineHeader-companyName");
  return tested ? [tested] : [];
}

export function jobUrlsFromHtml(html: string, pageUrl: string): Array<string> {
  const origin = originFromUrl(pageUrl);
  const found = new Set<string>();
  const add = (jobKey: string | undefined) => {
    if (isJobKey(jobKey)) {
      found.add(indeedViewUrl(jobKey, origin));
    }
  };

  try {
    add(jobKeyFromUrl(new URL(pageUrl)));
  } catch {
    // Ignore invalid page URLs; still scan the HTML.
  }

  for (const match of html.matchAll(/data-jk=["']([a-f0-9]{10,32})["']/gi)) {
    add(match[1]);
  }
  for (const match of html.matchAll(
    /[?&](?:amp;)?(?:vjk|jk)=([a-f0-9]{10,32})/gi,
  )) {
    add(match[1]);
  }
  for (const match of html.matchAll(/"jobkey"\s*:\s*"([a-f0-9]{10,32})"/gi)) {
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

  const key = jobKeyFromUrl(href);
  const origin = originFromUrl(pageUrl);
  if (key && isViewPath(href.pathname)) {
    return { url: indeedViewUrl(key, origin) };
  }
  if (key && isSearchPath(href.pathname)) {
    return {
      url: indeedViewUrl(key, origin),
      searchUrl: href.toString(),
    };
  }
  if (key) {
    return { url: indeedViewUrl(key, origin) };
  }
  return {
    url: href.toString(),
    searchUrl: isSearchPath(href.pathname) ? href.toString() : undefined,
  };
}

export function listingLooksLikeAJob(listing: JobListing) {
  const description = listing.description ?? "";
  const text = `${listing.title ?? ""} ${description}`;
  const jobView = /\/viewjob/i.test(listing.url) && /[?&]jk=[a-f0-9]{10,32}/i.test(listing.url);
  if (
    /just a moment|additional verification|verify you are human|access denied/i.test(
      text,
    ) &&
    description.length < 400
  ) {
    return false;
  }
  const hasJobBody =
    Boolean(listing.title) &&
    (description.length > 80 ||
      /\b(job description|responsibilities|qualifications|requirements|full-time|part-time)\b/i.test(
        text,
      ));
  if (hasJobBody) {
    return true;
  }
  if (jobView && listing.title && listing.company && !isSerpHeading(listing.title)) {
    return true;
  }
  return jobView && Boolean(listing.title) && description.length > 40;
}

export function listingFromHtml(
  html: string,
  pageUrl: string,
  searchUrl?: string,
): JobListing {
  const canonical = canonicalJobUrl(pageUrl);
  const url = canonical.url;
  const jobKey = jobKeyFromPage(pageUrl) ?? jobKeyFromPage(url);
  const fromModel = jobKey ? jobModelNearKey(html, jobKey) : {};
  const posting = jobPostingFromHtml(html);
  const postingCompany = organizationName(posting?.hiringOrganization);
  const employerNames = [
    jobKey ? companyNearJobTitle(html, jobKey) : "",
    jobKey ? companyFromViewPane(html, jobKey) : "",
    fromModel.company ?? "",
    postingCompany ?? "",
    ...employerNamesFromHtml(html),
  ].filter(Boolean);
  const postingTitle = typeof posting?.title === "string" ? posting.title : undefined;
  const postingDescription =
    typeof posting?.description === "string" ? stripHtml(posting.description) : "";
  const title = cleanTitle(
    (jobKey ? titleFromJobCard(html, jobKey) : "") ||
      (jobKey ? titleFromViewPane(html, jobKey) : "") ||
      fromModel.title ||
      postingTitle ||
      firstHeading(html) ||
      titleFromDocument(html),
    employerNames,
  );
  const description = redactEmployerNames(
    (postingDescription || jobBodyFromHtml(html, jobKey)).slice(0, DESCRIPTION_LIMIT),
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

export function isIndeedUrl(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return /(?:^|\.)indeed\.(?:com|co\.[a-z]{2}|[a-z]{2})$/i.test(host);
  } catch {
    return /indeed\.(?:com|co\.[a-z]{2}|[a-z]{2})/i.test(url);
  }
}

export const indeedStrategy: ScrapeStrategy = {
  id: "indeed",
  matches: isIndeedUrl,
  listingFromHtml,
  jobUrlsFromHtml,
  canonicalJobUrl,
  listingLooksLikeAJob,
};
