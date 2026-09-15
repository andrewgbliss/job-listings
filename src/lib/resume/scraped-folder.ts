import fs from "node:fs/promises";
import path from "node:path";
import { defaultScrapedFolderPath } from "./scraped-path";

export type ScrapedFolderItem = {
  domain: string;
  id: string;
  stem: string;
  relativePath: string;
  htmlPath?: string;
  listingPath?: string;
  resumePath?: string;
  hasHtml: boolean;
  hasListing: boolean;
  hasResume: boolean;
  resumeHref?: string;
  sourceUrl?: string;
  searchUrl?: string;
  title?: string;
};

export function scrapedFolderAbsPath(cwd = process.cwd()) {
  return path.join(cwd, ...defaultScrapedFolderPath.split("/"));
}

type StemFiles = {
  html?: string;
  listing?: string;
  resume?: string;
};

function stemFromFile(name: string): { stem: string; kind: keyof StemFiles } | null {
  if (name.endsWith("_resume.ts")) {
    return { stem: name.replace(/_resume\.ts$/, ""), kind: "resume" };
  }
  if (name.endsWith("_listing.json")) {
    return { stem: name.replace(/_listing\.json$/, ""), kind: "listing" };
  }
  if (name.endsWith(".html")) {
    return { stem: name.replace(/\.html$/, ""), kind: "html" };
  }
  return null;
}

async function readListingMeta(filePath: string) {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    const record = parsed as Record<string, unknown>;
    return {
      sourceUrl: typeof record.url === "string" ? record.url : undefined,
      searchUrl:
        typeof record.searchUrl === "string" ? record.searchUrl : undefined,
      title: typeof record.title === "string" ? record.title : undefined,
    };
  } catch {
    return {};
  }
}

export async function listScrapedFolder(
  dir = scrapedFolderAbsPath(),
): Promise<Array<ScrapedFolderItem>> {
  const domains = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const items: Array<ScrapedFolderItem> = [];

  for (const entry of domains) {
    if (!entry.isDirectory()) {
      continue;
    }
    const domain = entry.name;
    const domainDir = path.join(dir, domain);
    const files = await fs.readdir(domainDir).catch(() => []);
    const stems = new Map<string, StemFiles>();

    for (const file of files) {
      const parsed = stemFromFile(file);
      if (!parsed) {
        continue;
      }
      const current = stems.get(parsed.stem) ?? {};
      current[parsed.kind] = path.join(domainDir, file);
      stems.set(parsed.stem, current);
    }

    for (const [stem, parts] of [...stems.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const id = stem.replace(/_/g, "-");
      const listingMeta = parts.listing
        ? await readListingMeta(parts.listing)
        : {};
      items.push({
        domain,
        id,
        stem,
        relativePath: `${domain}/${stem}`,
        htmlPath: parts.html,
        listingPath: parts.listing,
        resumePath: parts.resume,
        hasHtml: Boolean(parts.html),
        hasListing: Boolean(parts.listing),
        hasResume: Boolean(parts.resume),
        resumeHref: parts.resume ? `/resume/${id}` : undefined,
        sourceUrl: listingMeta.sourceUrl,
        searchUrl: listingMeta.searchUrl,
        title: listingMeta.title,
      });
    }
  }

  return items;
}

export async function findScrapedById(id: string) {
  const items = await listScrapedFolder();
  return items.find((item) => item.id === id);
}
