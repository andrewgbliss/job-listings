import fs from "node:fs/promises";
import path from "node:path";
import { resumeIdFromJob, type JobListing } from "./utils/from-job-listing";
import {
  jobUrlsFromHtml,
  listingFromHtml,
  listingLooksLikeAJob,
} from "./utils/listing-from-html";
import { retailorScrapedResume } from "./utils/retailor-scraped";
import { findScrapedById, scrapedDirFor } from "./utils/scraped-folder";
import { processedAtIso, processedDateFolder } from "./utils/scraped-path";

const BUILTIN_IDS = new Set(["main", "ai-dev", "game-dev"]);

export { scrapedDirFor };

async function mergeJobUrls(seed: string, urls: Array<string>, outDir: string) {
  await fs.mkdir(outDir, { recursive: true });
  const filePath = path.join(outDir, "urls.json");
  let existing: Array<string> = [];
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(filePath, "utf8"));
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { urls?: unknown }).urls)
    ) {
      existing = (parsed as { urls: Array<unknown> }).urls.filter(
        (item): item is string => typeof item === "string",
      );
    }
  } catch {
    // No urls.json yet.
  }

  const merged = [...new Set([...existing, ...urls])];
  await fs.writeFile(
    filePath,
    `${JSON.stringify(
      {
        source: seed,
        scrapedAt: new Date().toISOString(),
        processedAt: processedAtIso(),
        urls: merged,
      },
      null,
      2,
    )}\n`,
  );
}

function repoPath(filePath: string) {
  return path.relative(process.cwd(), filePath).replaceAll("\\", "/");
}

/** Write HTML (+ listing JSON) under `scraped/YYYY_MM_DD/<domain>/`. */
export async function saveCapturedHtml(options: {
  html: string;
  listing: Pick<JobListing, "url"> & Partial<JobListing>;
  discoveredUrls?: Array<string>;
  id?: string;
}) {
  const { html, listing } = options;
  const id = options.id || resumeIdFromJob({ url: listing.url, skills: listing.skills ?? [] });
  if (BUILTIN_IDS.has(id)) {
    throw new Error(`Resume id "${id}" is reserved`);
  }

  const existing = await findScrapedById(id);
  const now = new Date();
  const dateFolder = processedDateFolder(now);
  const processedAt = processedAtIso(now);
  const outDir = existing?.htmlPath
    ? path.dirname(existing.htmlPath)
    : scrapedDirFor(listing.url, dateFolder);
  await fs.mkdir(outDir, { recursive: true });

  const stem = id.replace(/-/g, "_");
  const htmlPath = path.join(outDir, `${stem}.html`);
  const listingPath = path.join(outDir, `${stem}_listing.json`);

  let previousTitle: string | undefined;
  let previousCompany: string | undefined;
  try {
    const previous: unknown = JSON.parse(
      await fs.readFile(listingPath, "utf8"),
    );
    if (previous && typeof previous === "object") {
      const record = previous as { title?: unknown; company?: unknown };
      if (typeof record.title === "string" && record.title.trim()) {
        previousTitle = record.title.trim();
      }
      if (typeof record.company === "string" && record.company.trim()) {
        previousCompany = record.company.trim();
      }
    }
  } catch {
    // No listing JSON yet.
  }

  await fs.writeFile(htmlPath, html);
  await fs.writeFile(
    listingPath,
    `${JSON.stringify(
      {
        url: listing.url,
        searchUrl: listing.searchUrl ?? null,
        title: listing.title || previousTitle || null,
        company: listing.company || previousCompany || null,
        skills: listing.skills ?? [],
        processedAt,
      },
      null,
      2,
    )}\n`,
  );

  const discovered = options.discoveredUrls?.length
    ? options.discoveredUrls
    : [listing.url];
  await mergeJobUrls(listing.searchUrl || listing.url, discovered, outDir);

  return {
    id,
    htmlPath: repoPath(htmlPath),
    listingPath: repoPath(listingPath),
    processedAt,
    company: listing.company || previousCompany,
  };
}

export async function writeCapturedListing(options: {
  html: string;
  listing: JobListing;
  discoveredUrls?: Array<string>;
  id?: string;
}) {
  const saved = await saveCapturedHtml(options);
  const tailored = await retailorScrapedResume(saved.id);

  return {
    ...saved,
    id: tailored.id,
    title: tailored.tagline,
    resumePath: tailored.resumePath,
    resumeHref: tailored.resumeHref,
  };
}

export async function resyncCapturedListing(id: string) {
  if (BUILTIN_IDS.has(id)) {
    throw new Error(`Resume id "${id}" is reserved`);
  }

  const scrape = await findScrapedById(id);
  if (!scrape?.htmlPath) {
    throw new Error(`No captured HTML for "${id}"`);
  }

  const html = await fs.readFile(scrape.htmlPath, "utf8");
  const url = scrape.sourceUrl;
  if (!url) {
    throw new Error(`No listing URL for "${id}"`);
  }

  const listing = listingFromHtml(html, url, scrape.searchUrl);
  if (!listingLooksLikeAJob(listing)) {
    throw new Error("HTML did not look like a job listing");
  }

  return writeCapturedListing({
    html,
    listing,
    id,
    discoveredUrls: jobUrlsFromHtml(html, url),
  });
}
