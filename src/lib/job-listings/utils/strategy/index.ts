import {
  findKeywordSkills,
  skillHitsKeyword,
  sortSkillsByWeight,
  webDeveloperKeywords,
} from "../keywords";
import type { JobListing } from "../from-job-listing";
import { rewriteJobTitle } from "../rewrite-job-title";
import { dynamiteJobsStrategy } from "./dynamitejobs";
import { goengineerStrategy } from "./goengineer";
import { indeedStrategy } from "./indeed";
import { kslStrategy } from "./ksl";
import { linkedinStrategy } from "./linkedin";
import type { ScrapeOptions, ScrapeStrategy } from "./types";

export type { ScrapeOptions, ScrapeStrategy } from "./types";
export { dynamiteJobsStrategy } from "./dynamitejobs";
export { goengineerStrategy } from "./goengineer";
export { indeedStrategy } from "./indeed";
export { kslStrategy } from "./ksl";
export { linkedinStrategy } from "./linkedin";

const strategies: Array<ScrapeStrategy> = [
  linkedinStrategy,
  indeedStrategy,
  kslStrategy,
  dynamiteJobsStrategy,
  goengineerStrategy,
];

export function hostnameFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

export function missingStrategyMessage(url: string) {
  const domain = hostnameFromUrl(url);
  return `No scrape strategy for ${domain}. Add one under src/lib/job-listings/utils/strategy.`;
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
  listing.title = rewriteJobTitle(listing.title, html);
  const prose = [listing.title, listing.description].filter(Boolean).join(" ");
  const found = findKeywordSkills(prose, keywords);
  const explicit = listing.skills.filter((skill) => {
    const key = skill.trim().toLowerCase();
    const known = keywords.skills.some(
      (item) =>
        item.name.toLowerCase() === key ||
        item.aliases.some((alias) => alias.toLowerCase() === key),
    );
    return !known || skillHitsKeyword(skill, prose, keywords);
  });
  listing.skills = sortSkillsByWeight([...new Set([...explicit, ...found])]);
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
