import type { JobListing } from "../from-job-listing";
import { escapeRegExp, stripHtml } from "../html";
import type { ScrapeStrategy } from "./types";

const DESCRIPTION_LIMIT = 20_000;
const GENERIC_EMPLOYER = /^(inc|llc|ltd|corp|company|the company)$/i;
const LINKEDIN_JOB_ID = /\d{8,}/;

function asArray<T>(value: T | Array<T> | undefined): Array<T> {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
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
  return raw
    .replace(/\s*\|\s*LinkedIn\s*$/i, "")
    .split("|")[0]
    .replace(/\s+hiring\s+for\s+this\s+job.*$/i, "")
    .trim();
}

function decodeQueryValue(value: string) {
  try {
    return decodeURIComponent(value.replaceAll("+", " ")).replace(/\s+/g, " ").trim();
  } catch {
    return value.replaceAll("+", " ").replace(/\s+/g, " ").trim();
  }
}

/** LinkedIn job-details pages encode the posting title on the similar-jobs search URL. */
function titleFromSimilarJobsSearch(html: string): string {
  const match = html.match(
    /keywords=([\s\S]{3,200}?)(?:&|&amp;)origin=JobSearchOrigin_JOB_DETAILS_SIMILAR_JOBS/i,
  );
  return match?.[1] ? decodeQueryValue(match[1]) : "";
}

function titleFromSimilarJobsAlert(html: string): string {
  const match = html.match(
    /aria-label="Set alert for similar jobs as ([^"]+)"/i,
  );
  return match?.[1]?.trim() ?? "";
}

const ROLE_HINT =
  /\b(engineer|developer|architect|programmer|designer|manager|lead|director|consultant|analyst|specialist)\b/i;

const PLACE_WORD =
  "(?:(?!Engineer|Developer|Architect|Manager|Consultant|Analyst|Specialist|Director|Programmer|Designer)[A-Z][a-z.]+)";
const PLACE_RUN = `${PLACE_WORD}(?:[ -]${PLACE_WORD})*`;
const LOCATION_AT_END = new RegExp(
  `^(.*?)\\s+(${PLACE_RUN}),\\s*[A-Z]{2}$`,
);
const METRO_AT_END = new RegExp(
  `^(.*?)\\s+((?:Greater\\s+)?${PLACE_RUN}(?:\\s+Metropolitan)?\\s+Area)$`,
);

function titleAndCity(chunk: string): string {
  const trimmed = chunk.trim();
  const loc = trimmed.match(LOCATION_AT_END) ?? trimmed.match(METRO_AT_END);
  return loc?.[1]?.trim() ?? "";
}

function isChromeTitle(title: string) {
  return /premium|notification|linkedin|sign in|click apply|try premium|skip to main|is this information helpful|jobs under|date posted|easy apply|help center|accessibility|get the linkedin|corporation ©|early applicant|clicked apply|be an early|401|benefit|posted \d|job alerts|how promoted|promoted jobs|under \d+ applicants/i.test(
    title,
  );
}

function stripLocationSuffix(title: string) {
  return title
    .replace(
      /\s+in\s+[A-Za-z .'-]+,\s*[A-Z]{2}(?:\s*,\s*United States)?$/i,
      "",
    )
    .replace(new RegExp(`\\s+(${PLACE_RUN}),\\s*[A-Z]{2}(?:\\s*,\\s*United States)?$`), "")
    .replace(
      new RegExp(`\\s+((?:Greater\\s+)?${PLACE_RUN}(?:\\s+Metropolitan)?\\s+Area)$`),
      "",
    )
    .replace(/\s+United States$/i, "")
    .trim();
}

const ROLE_AT_END =
  /((?:Senior |Staff |Principal |Lead |Junior |Jr\.? |Technical )?(?:Full[ -]?Stack |Frontend |Front[ -]End |Backend |Back[ -]End |Web |Mobile |Platform |Cloud |Data |Digital |Application )?(?:Software )?(?:Engineer|Developer|Architect|Consultant|Manager|Designer|Analyst|Specialist)(?:\s+(?:I{1,3}|IV|V|[2-5]))?)$/i;

const ROLE_MODIFIER_PREFIX =
  /^(?:(?:senior|staff|principal|lead|junior|jr\.?|technical|web|mobile|software|platform|cloud|data|digital|application|product|full[ -]?stack|frontend|front[ -]end|backend|back[ -]end)(?:\s+|$))+$/i;

const GENERIC_ROLE =
  /^(engineer|developer|architect|programmer|designer|manager|lead|staff|principal|director|consultant|analyst|specialist)$/i;

/** Drop a company prefix when the string ends in a role ("Acme Senior Developer"). */
function roleWithoutEmployerPrefix(title: string): string {
  const match = title.match(ROLE_AT_END);
  const role = match?.[1]?.trim();
  if (!role || role === title) {
    return title;
  }
  const prefix = title.slice(0, Math.max(0, title.length - role.length)).trim();
  if (
    prefix.length >= 2 &&
    !ROLE_HINT.test(prefix) &&
    !ROLE_MODIFIER_PREFIX.test(prefix)
  ) {
    return role;
  }
  return title;
}

function compactRoleTitle(title: string): string {
  const dashed = title
    .split(/\s+[-–—]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (dashed.length >= 2) {
    const tail2 = dashed.slice(-2).join(" - ");
    if (
      tail2.length >= 8 &&
      tail2.length <= 80 &&
      ROLE_HINT.test(tail2) &&
      !isChromeTitle(tail2)
    ) {
      return tail2;
    }
    const last = dashed.at(-1) ?? "";
    if (
      last.length >= 8 &&
      last.length <= 80 &&
      ROLE_HINT.test(last) &&
      !isChromeTitle(last)
    ) {
      return last;
    }
  }
  return roleWithoutEmployerPrefix(title);
}

function cleanTitle(title: string | undefined): string | undefined {
  let trimmed = stripLocationSuffix(
    (title ?? "")
      .replace(/\s*\|\s*LinkedIn\s*$/i, "")
      .split("|")[0]
      .replace(/\btry premium for \$?0\b/gi, " ")
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
  if (!trimmed) {
    return undefined;
  }
  trimmed = compactRoleTitle(trimmed);
  if (!trimmed || trimmed.length < 8 || trimmed.length > 80) {
    return undefined;
  }
  if (GENERIC_ROLE.test(trimmed)) {
    return undefined;
  }
  if (isChromeTitle(trimmed)) {
    return undefined;
  }
  if (!ROLE_HINT.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function titleFromSeekingPhrase(text: string): string {
  const match = text.match(
    /\b(?:seeking|looking for|looking to hire|hiring)\s+(?:an?\s+)?(?:experienced(?:\s+and\s+highly\s+skilled)?\s+)?((?:Senior |Staff |Principal |Lead |Junior )?(?:level )?(?:Full[ -]?Stack |Frontend |Front[ -]End |Backend |Back[ -]End |Web |Mobile |Software )?(?:Engineer|Developer|Architect|Consultant|Manager))/i,
  );
  return match?.[1]?.replace(/\s+level\s+/i, " ").trim() ?? "";
}

function titleFromRoleLabel(text: string): string {
  const match = text.match(/\bRole Title:\s*([^\n.]{8,80})/i);
  if (!match) {
    return "";
  }
  return match[1].replace(/\s+[A-Z][A-Za-z]+(?:'s)\b[\s\S]*$/, "").trim();
}

function stripJobHeaderChrome(text: string) {
  let before = text
    .replace(
      /\s*(?:Your profile and resume match|Show match details|Is this information helpful\??|BETA|Use AI to assess|Get AI-powered advice|Start Premium|Tailor my resume|Help me stand out|People you can reach out to|Meet the hiring team|Job poster).*$/i,
      "",
    )
    .trim();

  const suffix =
    /\s+(?:Apply|Save|Easy Apply)$/i.source +
    "|" +
    /\s+(?:Hybrid|Remote|On-site|Onsite)\s+(?:Full-time|Part-time|Contract|Temporary)$/i.source +
    "|" +
    /\s+Responses managed off LinkedIn$/i.source +
    "|" +
    /\s+Promoted by hirer$/i.source +
    "|" +
    /\s+\d+\s+people clicked apply$/i.source +
    "|" +
    /\s+(?:Reposted\s+)?\d+\s+(?:hours?|days?|weeks?|months?)\s+ago$/i.source +
    "|" +
    /\s+·$/.source;
  const suffixPattern = new RegExp(`(?:${suffix})`, "i");
  for (let i = 0; i < 8; i += 1) {
    const next = before.replace(suffixPattern, "").trim();
    if (next === before) {
      break;
    }
    before = next;
  }
  return before;
}

function titleFromJobPageText(text: string): string {
  const about = text.search(/\bAbout (?:the|this) job\b/i);
  if (about < 0) {
    return "";
  }
  const before = stripJobHeaderChrome(
    text.slice(Math.max(0, about - 800), about).trim(),
  );

  const headerCore = titleAndCity(before);
  if (headerCore) {
    const cleaned = cleanTitle(headerCore);
    if (cleaned) {
      return cleaned;
    }
  }

  const parts = before.split(/\s+·\s+/);
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const core = titleAndCity(parts[index] ?? "");
    const cleaned = cleanTitle(core);
    if (cleaned) {
      return cleaned;
    }
  }
  return "";
}

/** Prefer the posting body, not LinkedIn chrome / related-jobs dumps. */
function jobBodyFromPageText(text: string): string {
  const about = text.search(/\bAbout (?:the|this) job\b/i);
  if (about < 0) {
    return "";
  }
  const body = text
    .slice(about)
    .replace(/^About (?:the|this) job\s*/i, "")
    .split(
      /\b(?:Set alert for similar jobs|People also viewed|Similar jobs|More jobs for you|Show more jobs)\b/i,
    )[0];
  return body.trim();
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

function titleFromJobTitleClass(html: string): string {
  const classParts = [
    "job-details-jobs-unified-top-card__job-title",
    "jobs-unified-top-card__job-title",
    "top-card-layout__title",
    "topcard__title",
  ];
  for (const part of classParts) {
    const text = textNearClass(html, part, 160)
      .split(/\s{2,}|[|·•]/)[0]
      ?.trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function employerNamesFromHtml(html: string): Array<string> {
  const fromAria = [...html.matchAll(/aria-label="Company(?:,| logo for,) ([^."']+)/gi)]
    .map((match) => match[1]?.trim() ?? "")
    .filter((name) => name.length >= 2 && name.length <= 80);
  const classParts = [
    "job-details-jobs-unified-top-card__company-name",
    "jobs-unified-top-card__company-name",
    "topcard__org-name-link",
  ];
  return [
    ...fromAria,
    ...classParts
      .map((part) => textNearClass(html, part, 80).split(/\s{2,}|[|·•]/)[0]?.trim() ?? "")
      .filter((name) => name.length >= 3 && name.length <= 80),
  ];
}

function employerNamesFromDescription(text: string): Array<string> {
  const names: Array<string> = [];
  const at = text.match(/\bAt ([A-Z][A-Za-z0-9&.-]{2,40})\b/);
  if (at?.[1]) {
    names.push(at[1]);
  }
  const possessive = text.match(/\b([A-Z][A-Za-z0-9&.-]{2,40})'s\b/);
  if (possessive?.[1]) {
    names.push(possessive[1]);
  }
  return names;
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
  const description = listing.description ?? "";
  const text = `${listing.title ?? ""} ${description}`.toLowerCase();
  const jobView = /\/jobs\/view\/\d{8,}/i.test(listing.url);
  const hasJobBody =
    Boolean(listing.title) ||
    description.length > 400 ||
    /\b(about the job|about this job|responsibilities|qualifications|requirements|we're hiring|we are hiring|job description|role title|what you'll do|what you will do)\b/i.test(
      text,
    );

  // LinkedIn chrome always includes Sign in / Join now. That is not a login wall
  // when the URL is a job posting or the page already has a role/description.
  if (hasJobBody) {
    return true;
  }
  if (jobView && description.length > 80) {
    return true;
  }
  if (/sign in|join now|log in to continue|authwall/i.test(text)) {
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
  return hints.some((hint) => text.includes(hint)) && description.length > 80;
}

export function listingFromHtml(
  html: string,
  pageUrl: string,
  searchUrl?: string,
): JobListing {
  const canonical = canonicalJobUrl(pageUrl);
  const url = canonical.url;
  const pageText = stripHtml(html);
  const jobBody = jobBodyFromPageText(pageText);
  const htmlCompanies = employerNamesFromHtml(html);
  const descriptionCompanies = employerNamesFromDescription(jobBody || pageText);
  const jsonLdCompanies: Array<string> = [];
  const employerNames = [...htmlCompanies, ...descriptionCompanies];
  const classDescription =
    textNearClass(html, "show-more-less-html__markup") ||
    textNearClass(html, "jobs-description") ||
    textNearId(html, "job-details") ||
    textNearClass(html, "job-details") ||
    textNearClass(html, "job-description");

  let listing: JobListing = {
    url,
    title:
      cleanTitle(titleFromSimilarJobsSearch(html)) ||
      cleanTitle(titleFromSimilarJobsAlert(html)) ||
      cleanTitle(firstHeading(html)) ||
      cleanTitle(titleFromJobTitleClass(html)) ||
      cleanTitle(titleFromRoleLabel(jobBody || pageText)) ||
      cleanTitle(titleFromJobPageText(pageText)) ||
      cleanTitle(titleFromDocument(html)) ||
      cleanTitle(titleFromSeekingPhrase(jobBody)),
    description: (classDescription || jobBody || pageText).slice(0, DESCRIPTION_LIMIT),
    skills: [],
    searchUrl: searchUrl || canonical.searchUrl,
  };

  for (const block of extractJsonLdBlocks(html)) {
    try {
      const posting = findJobPosting(JSON.parse(block));
      if (!posting) {
        continue;
      }
      jsonLdCompanies.push(
        ...stringNames(posting.hiringOrganization),
        ...stringNames(posting.employmentUnit),
      );
      employerNames.push(...jsonLdCompanies);
      const fromLd = listingFromJobPosting(posting, url);
      listing = {
        ...listing,
        ...fromLd,
        description: fromLd.description || listing.description,
        title: cleanTitle(fromLd.title) || listing.title,
        searchUrl: listing.searchUrl,
      };
      break;
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  }

  listing.company = firstEmployerName([
    ...htmlCompanies,
    ...jsonLdCompanies,
    ...descriptionCompanies,
  ]);
  if (listing.title) {
    listing.title = cleanTitle(
      redactEmployerFromTitle(listing.title, employerNames) || listing.title,
    );
  }
  if (listing.description) {
    listing.description = redactEmployerNames(listing.description, employerNames);
  }
  return listing;
}

export function isLinkedInUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "") === "linkedin.com";
  } catch {
    return /linkedin\.com/i.test(url);
  }
}

export const linkedinStrategy: ScrapeStrategy = {
  id: "linkedin",
  matches: isLinkedInUrl,
  listingFromHtml,
  jobUrlsFromHtml,
  canonicalJobUrl,
  listingLooksLikeAJob,
};

