import { retailorAllScraped } from "../src/lib/job-listings/utils/retailor-scraped";

async function main() {
  const written = await retailorAllScraped();
  for (const item of written) {
    console.log(`Rewrote ${item.resumePath}`);
    console.log(`Rewrote ${item.coverLetterPath}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
