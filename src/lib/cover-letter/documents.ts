import fs from "node:fs/promises";
import { getResumeById } from "../job-listings/utils/documents";
import { findScrapedById } from "../job-listings/utils/scraped-folder";
import { jobListingForRetailor } from "../job-listings/utils/retailor-scraped";
import {
  createCoverLetterFromJobListing,
  loadMainCoverLetterTemplate,
  tailorCoverLetter,
  type CoverLetterDocument,
} from "./from-job-listing";

export async function getCoverLetterById(
  id: string,
): Promise<CoverLetterDocument | undefined> {
  const scrape = await findScrapedById(id);
  if (scrape?.coverLetterPath) {
    const body = await fs.readFile(scrape.coverLetterPath, "utf8");
    return {
      id,
      body,
      position: scrape.title || id,
      company: scrape.company,
      sourceUrl: scrape.sourceUrl,
      searchUrl: scrape.searchUrl,
      processedAt: scrape.processedAt,
    };
  }

  if (scrape && (scrape.hasListing || scrape.hasHtml)) {
    const listing = await jobListingForRetailor(scrape);
    return createCoverLetterFromJobListing(listing, {
      id,
      searchUrl: listing.searchUrl,
      processedAt: scrape.processedAt,
    });
  }

  const resume = await getResumeById(id);
  if (!resume) {
    return undefined;
  }

  return {
    id: resume.id,
    body: tailorCoverLetter(loadMainCoverLetterTemplate(), {
      position: resume.tagline,
      company: resume.company,
      skills: resume.skills ?? [],
    }),
    position: resume.tagline,
    company: resume.company,
    sourceUrl: resume.sourceUrl,
    searchUrl: resume.searchUrl,
    processedAt: resume.processedAt,
  };
}
