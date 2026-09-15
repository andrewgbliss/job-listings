import fs from "node:fs/promises";
import path from "node:path";
import {
  createResumeFromJobListing,
  renderTailoredResumeModule,
  resumeFileName,
  type JobListing,
} from "./from-job-listing";
import { listingFromHtml } from "./listing-from-html";
import {
  findScrapedById,
  listScrapedFolder,
  scrapedResumeImportFrom,
  type ScrapedFolderItem,
} from "./scraped-folder";
import { processedAtIso } from "./scraped-path";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function parseJobListingJson(raw: unknown): JobListing | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  const url = asString(record.url);
  if (!url) {
    return undefined;
  }
  const skills = Array.isArray(record.skills)
    ? record.skills.filter((item): item is string => typeof item === "string")
    : [];
  return {
    url,
    title: asString(record.title),
    company: asString(record.company),
    description: asString(record.description),
    skills,
    searchUrl: asString(record.searchUrl),
  };
}

export async function jobListingForRetailor(
  scrape: ScrapedFolderItem,
): Promise<JobListing> {
  let fromJson: JobListing | undefined;
  if (scrape.listingPath) {
    const parsed: unknown = JSON.parse(
      await fs.readFile(scrape.listingPath, "utf8"),
    );
    fromJson = parseJobListingJson(parsed);
  }

  if (scrape.htmlPath) {
    const html = await fs.readFile(scrape.htmlPath, "utf8");
    const pageUrl = scrape.sourceUrl || fromJson?.url;
    if (!pageUrl) {
      throw new Error(`No listing URL for "${scrape.id}"`);
    }
    const fromHtml = listingFromHtml(
      html,
      pageUrl,
      scrape.searchUrl || fromJson?.searchUrl,
    );
    return {
      ...fromJson,
      ...fromHtml,
      title: fromHtml.title || fromJson?.title,
      company: fromHtml.company || fromJson?.company,
      description: fromHtml.description || fromJson?.description,
      skills:
        fromHtml.skills.length > 0 ? fromHtml.skills : (fromJson?.skills ?? []),
      url: fromHtml.url || fromJson?.url || pageUrl,
      searchUrl: fromHtml.searchUrl || fromJson?.searchUrl,
    };
  }

  if (!fromJson) {
    throw new Error(`No listing JSON or HTML for "${scrape.id}"`);
  }
  return fromJson;
}

export async function retailorScrapedResume(id: string) {
  const scrape = await findScrapedById(id);
  if (!scrape) {
    throw new Error(`No scraped listing for "${id}"`);
  }

  const listing = await jobListingForRetailor(scrape);
  const processedAt = processedAtIso();
  const tailored = createResumeFromJobListing(listing, {
    id,
    searchUrl: listing.searchUrl,
    processedAt,
  });

  const dir = scrape.htmlPath
    ? path.dirname(scrape.htmlPath)
    : scrape.listingPath
      ? path.dirname(scrape.listingPath)
      : undefined;
  if (!dir) {
    throw new Error(`No output folder for "${id}"`);
  }

  if (scrape.listingPath) {
    try {
      const parsed: unknown = JSON.parse(
        await fs.readFile(scrape.listingPath, "utf8"),
      );
      if (parsed && typeof parsed === "object") {
        await fs.writeFile(
          scrape.listingPath,
          `${JSON.stringify(
            {
              ...parsed,
              processedAt,
              ...(listing.title ? { title: listing.title } : {}),
              ...(listing.company ? { company: listing.company } : {}),
              skills: listing.skills,
            },
            null,
            2,
          )}\n`,
        );
      }
    } catch {
      // Listing JSON is optional for retailor.
    }
  }

  const resumePath = scrape.resumePath ?? path.join(dir, resumeFileName(id));
  await fs.writeFile(
    resumePath,
    renderTailoredResumeModule(tailored, {
      importFrom: scrapedResumeImportFrom,
    }),
  );

  return {
    id: tailored.id,
    tagline: tailored.tagline,
    resumePath: path.relative(process.cwd(), resumePath).replaceAll("\\", "/"),
    resumeHref: `/resume/${tailored.id}`,
  };
}

export async function retailorAllScraped() {
  const scrapes = await listScrapedFolder();
  const withListing = scrapes.filter((item) => item.hasListing || item.hasHtml);
  if (withListing.length === 0) {
    throw new Error("No scraped listings to retailor");
  }
  const written: Array<Awaited<ReturnType<typeof retailorScrapedResume>>> = [];
  for (const scrape of withListing) {
    written.push(await retailorScrapedResume(scrape.id));
  }
  return written;
}
