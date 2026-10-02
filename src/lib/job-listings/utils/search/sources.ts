import { stripHtml } from "../html";
import { fetchJson } from "./rate-limit";
import {
  DESCRIPTION_LIMIT,
  type ManualSearchLink,
  type SearchListing,
  type ZipPlace,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asList(value: unknown): Array<string> {
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) {
      return [item.trim()];
    }
    const name = asString(asRecord(item)?.name);
    return name ? [name] : [];
  });
}

function publishedAtFrom(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  const text = asString(value);
  if (!text) {
    return undefined;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function excerpt(html: unknown) {
  const text = stripHtml(asString(html));
  return text.length > DESCRIPTION_LIMIT
    ? `${text.slice(0, DESCRIPTION_LIMIT).trim()}…`
    : text;
}

function salaryRange(min: unknown, max: unknown, currency = "USD") {
  const low = typeof min === "number" && min > 0 ? min : undefined;
  const high = typeof max === "number" && max > 0 ? max : undefined;
  if (low == null && high == null) {
    return undefined;
  }
  try {
    const format = (value: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(value);
    if (low != null && high != null && low !== high) {
      return `${format(low)}–${format(high)}`;
    }
    return format(low ?? high ?? 0);
  } catch {
    return undefined;
  }
}

function listing(input: SearchListing): SearchListing | undefined {
  if (!input.title || !input.url) {
    return undefined;
  }
  try {
    const href = new URL(input.url);
    if (href.protocol !== "http:" && href.protocol !== "https:") {
      return undefined;
    }
  } catch {
    return undefined;
  }
  return {
    ...input,
    company: input.company || "Unknown",
    tags: input.tags.slice(0, 12),
    description: input.description,
  };
}

async function loadRemotive(normalized: string): Promise<Array<SearchListing>> {
  const payload = await fetchJson(
    `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(normalized)}`,
  );
  const jobs = asRecord(payload)?.jobs;
  if (!Array.isArray(jobs)) {
    return [];
  }
  return jobs.flatMap((item) => {
    const record = asRecord(item);
    if (!record) {
      return [];
    }
    const salary = asString(record.salary);
    const next = listing({
      id: `remotive-${String(record.id ?? record.url ?? "")}`,
      source: "remotive",
      sourceLabel: "Remotive",
      title: asString(record.title),
      company: asString(record.company_name),
      url: asString(record.url),
      location: asString(record.candidate_required_location) || undefined,
      publishedAt: publishedAtFrom(record.publication_date),
      salary: salary || undefined,
      tags: asList(record.tags),
      description: excerpt(record.description),
    });
    return next ? [next] : [];
  });
}

async function loadRemoteOk(): Promise<Array<SearchListing>> {
  const payload = await fetchJson("https://remoteok.com/api");
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload.flatMap((item) => {
    const record = asRecord(item);
    if (!record || !asString(record.position)) {
      return [];
    }
    const next = listing({
      id: `remoteok-${String(record.id ?? record.slug ?? "")}`,
      source: "remoteok",
      sourceLabel: "Remote OK",
      title: asString(record.position),
      company: asString(record.company),
      url: asString(record.url) || asString(record.apply_url),
      location: asString(record.location) || undefined,
      publishedAt: publishedAtFrom(record.date) ?? publishedAtFrom(record.epoch),
      salary: salaryRange(record.salary_min, record.salary_max),
      tags: asList(record.tags),
      description: excerpt(record.description),
    });
    return next ? [next] : [];
  });
}

async function loadArbeitnow(): Promise<Array<SearchListing>> {
  const payload = await fetchJson(
    "https://www.arbeitnow.com/api/job-board-api",
  );
  const data = asRecord(payload)?.data;
  if (!Array.isArray(data)) {
    return [];
  }
  return data.flatMap((item) => {
    const record = asRecord(item);
    if (!record) {
      return [];
    }
    const next = listing({
      id: `arbeitnow-${asString(record.slug) || asString(record.url)}`,
      source: "arbeitnow",
      sourceLabel: "Arbeitnow",
      title: asString(record.title),
      company: asString(record.company_name),
      url: asString(record.url),
      location: asString(record.location) || undefined,
      publishedAt: publishedAtFrom(record.created_at),
      tags: [...asList(record.tags), ...asList(record.job_types)],
      description: excerpt(record.description),
    });
    return next ? [next] : [];
  });
}

async function loadJobicyPage(url: string): Promise<Array<SearchListing>> {
  const payload = await fetchJson(url);
  const jobs = asRecord(payload)?.jobs;
  if (!Array.isArray(jobs)) {
    return [];
  }
  return jobs.flatMap((item) => {
    const record = asRecord(item);
    if (!record) {
      return [];
    }
    const next = listing({
      id: `jobicy-${String(record.id ?? record.jobSlug ?? "")}`,
      source: "jobicy",
      sourceLabel: "Jobicy",
      title: asString(record.jobTitle),
      company: asString(record.companyName),
      url: asString(record.url),
      location: asString(record.jobGeo) || undefined,
      publishedAt: publishedAtFrom(record.pubDate),
      salary: salaryRange(
        record.salaryMin,
        record.salaryMax,
        asString(record.salaryCurrency) || "USD",
      ),
      tags: [...asList(record.jobIndustry), ...asList(record.jobType)],
      description: excerpt(record.jobDescription || record.jobExcerpt),
    });
    return next ? [next] : [];
  });
}

async function loadJobicy(normalized: string): Promise<Array<SearchListing>> {
  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length === 1) {
    const tagged = await loadJobicyPage(
      `https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(tokens[0])}`,
    );
    if (tagged.length > 0) {
      return tagged;
    }
  }
  return loadJobicyPage("https://jobicy.com/api/v2/remote-jobs?count=50");
}

async function loadMuse(): Promise<Array<SearchListing>> {
  const listings: Array<SearchListing> = [];
  for (const page of [0, 1]) {
    const payload = await fetchJson(
      `https://www.themuse.com/api/public/jobs?page=${page}`,
    );
    const results = asRecord(payload)?.results;
    if (!Array.isArray(results)) {
      continue;
    }
    for (const item of results) {
      const record = asRecord(item);
      if (!record) {
        continue;
      }
      const company = asRecord(record.company);
      const refs = asRecord(record.refs);
      const next = listing({
        id: `muse-${String(record.id ?? "")}`,
        source: "themuse",
        sourceLabel: "The Muse",
        title: asString(record.name),
        company: asString(company?.name),
        url: asString(refs?.landing_page),
        location: asList(record.locations).slice(0, 3).join(", ") || undefined,
        publishedAt: publishedAtFrom(record.publication_date),
        tags: [...asList(record.categories), ...asList(record.levels)],
        description: excerpt(record.contents),
      });
      if (next) {
        listings.push(next);
      }
    }
  }
  return listings;
}

export type FeedSource = {
  id: string;
  label: string;
  creditUrl: string;
  /** Cache key. Remotive results depend on the keyword. */
  cacheKey: (normalized: string) => string;
  note?: string;
  load: (normalized: string) => Promise<Array<SearchListing>>;
};

export const feedSources: Array<FeedSource> = [
  {
    id: "remotive",
    label: "Remotive",
    creditUrl: "https://remotive.com",
    cacheKey: (normalized) => `remotive-${normalized.replace(/\s+/g, "-")}`,
    load: loadRemotive,
  },
  {
    id: "remoteok",
    label: "Remote OK",
    creditUrl: "https://remoteok.com",
    cacheKey: () => "remoteok",
    load: () => loadRemoteOk(),
  },
  {
    id: "arbeitnow",
    label: "Arbeitnow",
    creditUrl: "https://www.arbeitnow.com",
    cacheKey: () => "arbeitnow",
    note: "First page of their public board.",
    load: () => loadArbeitnow(),
  },
  {
    id: "jobicy",
    label: "Jobicy",
    creditUrl: "https://jobicy.com",
    cacheKey: (normalized) => {
      const tokens = normalized.split(" ").filter(Boolean);
      return tokens.length === 1 ? `jobicy-${tokens[0]}` : "jobicy-latest";
    },
    note: "Latest jobs, or a tag match for a single word.",
    load: loadJobicy,
  },
  {
    id: "themuse",
    label: "The Muse",
    creditUrl: "https://www.themuse.com",
    cacheKey: () => "themuse-latest",
    note: "Latest two pages, then filtered locally.",
    load: () => loadMuse(),
  },
];

export function manualSearchLinks(query: string, zip = ""): Array<ManualSearchLink> {
  const keywords = query.trim();
  const location = zip.trim();
  const googleQuery = location
    ? `${keywords} jobs near ${location}`
    : `${keywords} jobs`;
  const linkedInLocation = location
    ? `&location=${encodeURIComponent(location)}`
    : "";
  const indeedLocation = location ? `&l=${encodeURIComponent(location)}` : "";
  return [
    {
      label: "Google",
      url: `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}&ibp=htl;jobs`,
    },
    {
      label: "LinkedIn",
      url: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords)}${linkedInLocation}`,
    },
    {
      label: "Indeed",
      url: `https://www.indeed.com/jobs?q=${encodeURIComponent(keywords)}${indeedLocation}`,
    },
  ];
}

export function listingMatches(item: SearchListing, normalized: string) {
  const tokens = normalized.split(" ").filter((token) => token.length > 1);
  if (tokens.length === 0) {
    return false;
  }
  const haystack = [
    item.title,
    item.company,
    item.location,
    item.tags.join(" "),
    item.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[-_/]+/g, " ");
  return tokens.every((token) => haystack.includes(token));
}

function hasStateAbbr(location: string, abbr: string) {
  return new RegExp(`(?:^|[,\\s])${abbr}(?:$|[,\\s])`).test(location);
}

/** Keep remote, nationwide, and local listings when a zip was resolved. */
export function listingFitsPlace(item: SearchListing, place?: ZipPlace) {
  if (!place) {
    return true;
  }
  const location = item.location?.trim() ?? "";
  if (!location) {
    return true;
  }
  if (/\b(remote|worldwide|anywhere|global|work from home)\b/i.test(location)) {
    return true;
  }
  if (/\b(united states|usa|u\.s\.a\.|u\.s\.)\b/i.test(location) || /\bUS\b/.test(location)) {
    return true;
  }
  const text = location.toLowerCase();
  if (text.includes(place.zip) || text.includes(place.city.toLowerCase())) {
    return true;
  }
  if (text.includes(place.state.toLowerCase()) || hasStateAbbr(location, place.stateAbbr)) {
    return true;
  }
  return false;
}
