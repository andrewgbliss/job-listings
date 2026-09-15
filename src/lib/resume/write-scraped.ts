import fs from "node:fs/promises";
import path from "node:path";
import {
  createResumeFromJobListing,
  renderTailoredResumeModule,
  resumeExportName,
  resumeFileName,
  resumeIdFromJob,
  type JobListing,
} from "./from-job-listing";
import {
  jobUrlsFromHtml,
  listingFromHtml,
  listingLooksLikeAJob,
} from "./listing-from-html";
import { findScrapedById, scrapedFolderAbsPath } from "./scraped-folder";

const SCRAPED_ROOT = scrapedFolderAbsPath();
const BUILTIN_IDS = new Set(["main", "ai-dev", "game-dev"]);

function domainFolder(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export function scrapedDirFor(url: string) {
  return path.join(SCRAPED_ROOT, domainFolder(url));
}

async function collectScrapedResumeFiles(dir: string): Promise<Array<string>> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: Array<string> = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectScrapedResumeFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith("_resume.ts")) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

export async function writeScrapedBarrel() {
  const files = await collectScrapedResumeFiles(SCRAPED_ROOT);
  const modules = files.map((filePath) => {
    const id = path
      .basename(filePath)
      .replace(/_resume\.ts$/, "")
      .replace(/_/g, "-");
    const importPath = `./${path
      .relative(SCRAPED_ROOT, filePath)
      .replaceAll("\\", "/")
      .replace(/\.ts$/, "")}`;
    return {
      exportName: resumeExportName(id),
      importPath,
    };
  });

  const imports = modules
    .map((module) => `import { ${module.exportName} } from "${module.importPath}";`)
    .join("\n");
  const list =
    modules.length > 0
      ? `\n  ${modules.map((module) => module.exportName).join(",\n  ")},\n`
      : "\n";

  await fs.mkdir(SCRAPED_ROOT, { recursive: true });
  await fs.writeFile(
    path.join(SCRAPED_ROOT, "index.ts"),
    `import type { ResumeDocument } from "../types";
${imports ? `${imports}\n` : ""}
export const scrapedResumes: Array<ResumeDocument> = [${list}];
`,
  );
}

async function mergeJobUrls(seed: string, urls: Array<string>) {
  const dir = scrapedDirFor(seed);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, "urls.json");
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
        urls: merged,
      },
      null,
      2,
    )}\n`,
  );
}

export async function writeCapturedListing(options: {
  html: string;
  listing: JobListing;
  discoveredUrls?: Array<string>;
}) {
  const { html, listing } = options;
  const id = resumeIdFromJob(listing);
  if (BUILTIN_IDS.has(id)) {
    throw new Error(`Resume id "${id}" is reserved`);
  }

  const outDir = scrapedDirFor(listing.url);
  await fs.mkdir(outDir, { recursive: true });

  const stem = id.replace(/-/g, "_");
  const htmlPath = path.join(outDir, `${stem}.html`);
  const listingPath = path.join(outDir, `${stem}_listing.json`);
  const resumePath = path.join(outDir, resumeFileName(id));

  await fs.writeFile(htmlPath, html);
  await fs.writeFile(
    listingPath,
    `${JSON.stringify(
      {
        url: listing.url,
        searchUrl: listing.searchUrl ?? null,
        title: listing.title ?? null,
        skills: listing.skills,
      },
      null,
      2,
    )}\n`,
  );

  const tailored = createResumeFromJobListing(listing, {
    id,
    searchUrl: listing.searchUrl,
  });
  await fs.writeFile(
    resumePath,
    renderTailoredResumeModule(tailored, { importFrom: "../.." }),
  );

  const discovered = options.discoveredUrls?.length
    ? options.discoveredUrls
    : [listing.url];
  await mergeJobUrls(listing.searchUrl || listing.url, discovered);
  await writeScrapedBarrel();

  return {
    id: tailored.id,
    title: tailored.tagline,
    htmlPath: path.relative(process.cwd(), htmlPath).replaceAll("\\", "/"),
    listingPath: path.relative(process.cwd(), listingPath).replaceAll("\\", "/"),
    resumePath: path.relative(process.cwd(), resumePath).replaceAll("\\", "/"),
    resumeHref: `/resume/${tailored.id}`,
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
    discoveredUrls: jobUrlsFromHtml(html, url),
  });
}
