import type { JobListing } from "../from-job-listing";
import type { KeywordPack } from "../keywords/types";

export type ScrapeStrategy = {
  id: string;
  matches(url: string): boolean;
  listingFromHtml(
    html: string,
    pageUrl: string,
    searchUrl?: string,
  ): JobListing;
  jobUrlsFromHtml(html: string, pageUrl: string): Array<string>;
  canonicalJobUrl(pageUrl: string): { url: string; searchUrl?: string };
  listingLooksLikeAJob(listing: JobListing): boolean;
};

export type ScrapeOptions = {
  strategy?: ScrapeStrategy;
  keywords?: KeywordPack;
};
