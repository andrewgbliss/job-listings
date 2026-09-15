import {
  findKeywordSkills,
  sortSkillsByWeight,
  webDeveloperKeywords,
} from "../keywords";
import type { JobListing } from "../from-job-listing";
import { kslStrategy } from "./ksl";
import { linkedinStrategy } from "./linkedin";
import type { ScrapeOptions, ScrapeStrategy } from "./types";

export type { ScrapeOptions, ScrapeStrategy } from "./types";
export { kslStrategy } from "./ksl";
export { linkedinStrategy } from "./linkedin";

const strategies: Array<ScrapeStrategy> = [linkedinStrategy, kslStrategy];

export function hostnameFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

export function missingStrategyMessage(url: string) {
  const domain = hostnameFromUrl(url);
  return `No scrape strategy for ${domain}. Add one under src/lib/resume/utils/strategy.`;
}

export function strategyForUrl(url: string) {
  return strategies.find((strategy) => strategy.matches(url));
}

export function listingFromHtml(
  html: string,
  pageUrl: string,
  searchUrl?: string,
  options: ScrapeOptions = {},
): JobListing {
  const strategy = options.strategy ?? strategyForUrl(pageUrl);
  if (!strategy) {
    throw new Error(missingStrategyMessage(pageUrl));
  }
  const keywords = options.keywords ?? webDeveloperKeywords;
  const listing = strategy.listingFromHtml(html, pageUrl, searchUrl);
  listing.skills = sortSkillsByWeight(
    findKeywordSkills(
      [listing.title, listing.description, listing.skills.join(" ")]
        .filter(Boolean)
        .join(" "),
      keywords,
    ),
  );
  return listing;
}

export function jobUrlsFromHtml(html: string, pageUrl: string) {
  const strategy = strategyForUrl(pageUrl);
  if (!strategy) {
    return [];
  }
  return strategy.jobUrlsFromHtml(html, pageUrl);
}

export function canonicalJobUrl(pageUrl: string) {
  const strategy = strategyForUrl(pageUrl);
  if (!strategy) {
    return { url: pageUrl };
  }
  return strategy.canonicalJobUrl(pageUrl);
}

export function listingLooksLikeAJob(listing: JobListing) {
  const strategy = strategyForUrl(listing.url);
  if (!strategy) {
    return false;
  }
  return strategy.listingLooksLikeAJob(listing);
}

export {
  isLinkedInUrl,
  isSearchPath,
  linkedInViewUrl,
} from "./linkedin";
