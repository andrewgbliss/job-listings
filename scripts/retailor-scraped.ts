import fs from "node:fs/promises";
import path from "node:path";
import {
  createResumeFromJobListing,
  renderTailoredResumeModule,
  resumeFileName,
  type JobListing,
} from "../src/lib/resume/from-job-listing";

const SCRAPED_ROOT = path.join("src", "lib", "resume", "scraped");

async function listingFiles(dir: string): Promise<Array<string>> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: Array<string> = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listingFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith("_listing.json")) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const files = await listingFiles(SCRAPED_ROOT);
  if (files.length === 0) {
    throw new Error("No *_listing.json files under src/lib/resume/scraped");
  }

  for (const filePath of files) {
    const listing = JSON.parse(await fs.readFile(filePath, "utf8")) as JobListing;
    const id = path
      .basename(filePath)
      .replace(/_listing\.json$/, "")
      .replace(/_/g, "-");
    const tailored = createResumeFromJobListing(listing, { id });
    const outPath = path.join(path.dirname(filePath), resumeFileName(id));
    await fs.writeFile(
      outPath,
      renderTailoredResumeModule(tailored, { importFrom: "../.." }),
    );
    console.log(`Rewrote ${outPath}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
