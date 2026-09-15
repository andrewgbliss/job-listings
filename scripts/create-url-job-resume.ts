/**
 * Scan job search/listing URLs and write tailored resumes from main_resume.ts.
 *
 * Batch (reads src/lib/resume/urls_to_scrape.json):
 *   npm run resume:from-url
 *
 * First page only — no pagination. Job URLs are saved under
 * src/lib/resume/scraped/YYYY_MM_DD/<domain>/urls.json, then each posting is scraped
 * into a resume module in that same folder.
 *
 * Single posting:
 *   npm run resume:from-url -- https://example.com/jobs/senior-engineer --id job-123
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { Page } from "playwright";
import {
  createResumeFromJobListing,
  renderTailoredResumeModule,
  resumeFileName,
  resumeIdFromJob,
  type JobListing,
} from "../src/lib/resume/utils/from-job-listing";
import { listingLooksLikeAJob } from "../src/lib/resume/utils/listing-from-html";
import { findKeywordSkills, webDeveloperKeywords } from "../src/lib/resume/utils/keywords";
import { getResumeById } from "../src/lib/resume/utils/documents";
import { scrapedResumeImportFrom } from "../src/lib/resume/utils/scraped-folder";
import { processedAtIso } from "../src/lib/resume/utils/scraped-path";
import { scrapedDirFor } from "../src/lib/resume/write-scraped";

const RESUME_DIR = path.join("src", "lib", "resume");
const URLS_FILE = path.join(RESUME_DIR, "urls_to_scrape.json");
const GOTO_TIMEOUT_MS = 45_000;
const SETTLE_MS = 2_000;
const JOB_DELAY_MS = 1_000;
const LOGIN_TIMEOUT_MS = 5 * 60_000;
const BUILTIN_IDS = new Set(["main", "ai-dev", "game-dev"]);

type CliOptions = {
  url?: string;
  id?: string;
  maxJobs?: number;
  force?: boolean;
  dryRun?: boolean;
  headed?: boolean;
  help?: boolean;
};

function printUsage() {
  console.log(`Usage:
  npm run resume:from-url
  npm run resume:from-url -- <job-url> [options]
  npx tsx scripts/create-url-job-resume.ts [job-url] [options]

With no URL, reads ${URLS_FILE}, collects first-page job links, saves them
under src/lib/resume/scraped/YYYY_MM_DD/<domain>/, then writes a resume per posting.

Options:
  --id <slug>       Resume id (single-URL mode)
  --max-jobs <n>    Limit work-history entries (default: keep all jobs)
  --force           Overwrite an existing generated resume
  --dry-run         Print modules without writing files
  --headed          Open Chromium so you can sign in to LinkedIn
  -h, --help        Show this help
`);
}

function parseArgs(argv: Array<string>): CliOptions {
  const options: CliOptions = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      return { help: true };
    }
    if (arg === "--force") {
      options.force = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--headed") {
      options.headed = true;
      continue;
    }
    if (arg === "--id") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("--id requires a slug");
      }
      options.id = value;
      i += 1;
      continue;
    }
    if (arg === "--max-jobs") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("--max-jobs requires a number");
      }
      options.maxJobs = Number(value);
      if (!Number.isFinite(options.maxJobs) || options.maxJobs < 1) {
        throw new Error("--max-jobs must be a positive number");
      }
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (options.url) {
      throw new Error("Only one job URL is supported in single mode");
    }
    options.url = arg;
  }

  return options;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function asArray<T>(value: T | Array<T> | undefined): Array<T> {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function findJobPosting(data: unknown): Record<string, unknown> | undefined {
  if (!data) {
    return undefined;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findJobPosting(item);
      if (found) {
        return found;
      }
    }
    return undefined;
  }
  if (typeof data !== "object") {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  const types = asArray(record["@type"]).map(String);
  if (types.includes("JobPosting")) {
    return record;
  }
  if (record["@graph"]) {
    return findJobPosting(record["@graph"]);
  }
  return undefined;
}

function listingFromJobPosting(
  posting: Record<string, unknown>,
  url: string,
): Partial<JobListing> {
  const skills = asArray(posting.skills)
    .flatMap((skill) => String(skill).split(/[,/|]/))
    .map((skill) => skill.trim())
    .filter(Boolean);

  return {
    url,
    title: posting.title ? String(posting.title) : undefined,
    description: posting.description
      ? stripHtml(String(posting.description))
      : "",
    skills,
  };
}

function stringNames(value: unknown): Array<string> {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length >= 3 ? [trimmed] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(stringNames);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return [
      ...stringNames(record.name),
      ...stringNames(record.legalName),
      ...stringNames(record.alternateName),
      ...stringNames(record.brand),
    ];
  }
  return [];
}

function employerNamesFromPosting(
  posting: Record<string, unknown>,
): Array<string> {
  return [
    ...stringNames(posting.hiringOrganization),
    ...stringNames(posting.employmentUnit),
  ];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const GENERIC_EMPLOYER = /^(inc|llc|ltd|corp|company|the company)$/i;

function uniqueEmployerNames(names: Array<string>): Array<string> {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))]
    .filter((name) => name.length >= 3 && !GENERIC_EMPLOYER.test(name))
    .sort((a, b) => b.length - a.length);
}

function firstEmployerName(names: Array<string>): string | undefined {
  return names
    .map((name) => name.replace(/\s+/g, " ").trim())
    .find(
      (name) =>
        name.length >= 2 && name.length <= 80 && !GENERIC_EMPLOYER.test(name),
    );
}

function redactEmployerNames(text: string, names: Array<string>): string {
  let out = text;
  for (const name of uniqueEmployerNames(names)) {
    out = out.replace(new RegExp(escapeRegExp(name), "gi"), "the company");
  }
  return out.replace(/\s+/g, " ").trim();
}

function redactEmployerFromTitle(title: string, names: Array<string>): string {
  let out = title;
  for (const name of uniqueEmployerNames(names)) {
    const escaped = escapeRegExp(name);
    out = out.replace(new RegExp(`\\s+[-–—|@]\\s*${escaped}.*$`, "i"), "");
    out = out.replace(new RegExp(`\\s+(?:at|@)\\s+${escaped}.*$`, "i"), "");
    out = out.replace(new RegExp(escaped, "gi"), "");
  }
  return out.replace(/\s+/g, " ").trim();
}

function isSearchPath(pathname: string) {
  return (
    /\/jobs\/search/i.test(pathname) || /\/jobs\/search-results/i.test(pathname)
  );
}

function isLinkedInJobId(jobId: string) {
  return /^\d{8,}$/.test(jobId);
}

function linkedInViewUrl(jobId: string) {
  return `https://www.linkedin.com/jobs/view/${jobId}`;
}

function canonicalizeJobUrl(href: string, seed: string): string | null {
  let url: URL;
  try {
    url = new URL(href, seed);
  } catch {
    return null;
  }
  url.hash = "";

  const view = url.pathname.match(/\/jobs\/view\/(\d+)/);
  if (view?.[1] && isLinkedInJobId(view[1])) {
    return linkedInViewUrl(view[1]);
  }

  const currentJobId = url.searchParams.get("currentJobId");
  if (
    currentJobId &&
    isLinkedInJobId(currentJobId) &&
    url.hostname.includes("linkedin")
  ) {
    return linkedInViewUrl(currentJobId);
  }

  if (isSearchPath(url.pathname)) {
    return null;
  }

  const path = url.pathname.toLowerCase();
  if (
    /\/jobs\/\d+/.test(path) ||
    /\/job\/[^/]+/.test(path) ||
    /\/positions\/[^/]+/.test(path) ||
    url.hostname.includes("greenhouse.io") ||
    url.hostname.includes("lever.co") ||
    url.hostname.includes("ashbyhq.com") ||
    url.hostname.includes("myworkdayjobs.com")
  ) {
    url.search = "";
    return url.href;
  }

  return null;
}

function addLinkedInJobId(found: Set<string>, jobId: string | undefined) {
  if (jobId && isLinkedInJobId(jobId)) {
    found.add(linkedInViewUrl(jobId));
  }
}

async function dismissOverlays(page: Page) {
  const labels = [
    /accept/i,
    /agree/i,
    /allow/i,
    /dismiss/i,
    /close/i,
    /reject/i,
  ];
  for (const label of labels) {
    const button = page.getByRole("button", { name: label }).first();
    if ((await button.count()) > 0) {
      await button.click({ timeout: 1_000 }).catch(() => undefined);
    }
  }
}

async function scrollFirstPageJobList(page: Page) {
  let previous = 0;
  let stable = 0;
  for (let step = 0; step < 8; step += 1) {
    const count = await page.evaluate(() => {
      const root =
        document.querySelector(".scaffold-layout__list") ??
        document.querySelector("ul.jobs-search__results-list") ??
        document.querySelector(".jobs-search-results-list");
      if (root) {
        root.scrollTop = root.scrollHeight;
      } else {
        window.scrollBy(0, 800);
      }
      const scope = root ?? document;
      return scope.querySelectorAll(
        '[data-occludable-job-id], [data-entity-urn*="jobPosting"], [data-job-id], a[href*="/jobs/view/"], a[href*="currentJobId="]',
      ).length;
    });
    if (count <= previous) {
      stable += 1;
      if (stable >= 3) {
        break;
      }
    } else {
      stable = 0;
    }
    previous = count;
    await delay(700);
  }
}

async function collectJobIdsFromResultsList(page: Page) {
  return page.evaluate(() => {
    const root =
      document.querySelector(".scaffold-layout__list") ??
      document.querySelector("ul.jobs-search__results-list") ??
      document.querySelector(".jobs-search-results-list") ??
      document.querySelector("main");
    if (!root) {
      return [] as Array<string>;
    }
    const ids = new Set<string>();
    const nodes = root.querySelectorAll(
      "[data-occludable-job-id], [data-job-id], [data-entity-urn], a[href]",
    );
    for (const node of nodes) {
      const occlude = node.getAttribute("data-occludable-job-id");
      const jobId = node.getAttribute("data-job-id");
      const urn = node.getAttribute("data-entity-urn") ?? "";
      const href =
        (node instanceof HTMLAnchorElement
          ? node.href
          : node.getAttribute("href")) ?? "";
      if (occlude) {
        ids.add(occlude);
      }
      if (jobId) {
        ids.add(jobId);
      }
      const urnMatch = urn.match(/jobPosting:(\d+)/);
      if (urnMatch?.[1]) {
        ids.add(urnMatch[1]);
      }
      const view = href.match(/\/jobs\/view\/(\d+)/);
      if (view?.[1]) {
        ids.add(view[1]);
      }
      try {
        const current = new URL(href, location.origin).searchParams.get(
          "currentJobId",
        );
        if (current) {
          ids.add(current);
        }
      } catch {
        // Ignore invalid hrefs.
      }
    }
    return [...ids];
  });
}

async function pageLooksLikeLinkedInLogin(page: Page) {
  const href = page.url();
  if (/linkedin\.com\/(login|checkpoint|authwall|uas\/login)/i.test(href)) {
    return true;
  }
  const body = (
    await page
      .locator("body")
      .innerText()
      .catch(() => "")
  ).toLowerCase();
  return /sign in to linkedin|join now|authwall|welcome back/.test(body);
}

async function waitForLinkedInLogin(page: Page) {
  console.warn(
    "LinkedIn login wall. Sign in in the Chromium window. Waiting up to 5 minutes after you are logged in...",
  );
  await page.waitForFunction(
    () => {
      const href = location.href;
      if (/\/login|\/checkpoint|\/authwall|\/uas\/login/.test(href)) {
        return false;
      }
      return Boolean(
        document.querySelector("#global-nav") ||
        document.querySelector(".global-nav__me") ||
        document.querySelector("img.global-nav__me-photo"),
      );
    },
    { timeout: LOGIN_TIMEOUT_MS },
  );
}

async function loadSearchFirstPage(page: Page, seed: string) {
  console.log(`Opening ${seed}`);
  await page.goto(seed, {
    waitUntil: "domcontentloaded",
    timeout: GOTO_TIMEOUT_MS,
  });
  await dismissOverlays(page);
  await page
    .waitForSelector(
      'a[href*="/jobs/view/"], a[href*="currentJobId="], [data-occludable-job-id], [data-entity-urn*="jobPosting"], .scaffold-layout__list li, a[href*="/job/"]',
      { timeout: 20_000 },
    )
    .catch(() => undefined);
  await delay(SETTLE_MS);
  await scrollFirstPageJobList(page);
  await delay(SETTLE_MS);
}

async function collectFirstPageJobUrls(
  page: Page,
  seed: string,
  headed: boolean,
) {
  await loadSearchFirstPage(page, seed);

  const found = new Set<string>();
  const seedUrl = new URL(seed);
  addLinkedInJobId(
    found,
    seedUrl.searchParams.get("currentJobId") ?? undefined,
  );

  if (seedUrl.hostname.includes("linkedin.com")) {
    for (const jobId of await collectJobIdsFromResultsList(page)) {
      addLinkedInJobId(found, jobId);
    }
    if (found.size <= 1 && (await pageLooksLikeLinkedInLogin(page))) {
      if (!headed) {
        console.warn(
          "LinkedIn did not show the saved search results (login wall). Re-run headed so the session can sign in: npm run resume:from-url -- --headed",
        );
      } else {
        await waitForLinkedInLogin(page);
        found.clear();
        addLinkedInJobId(
          found,
          seedUrl.searchParams.get("currentJobId") ?? undefined,
        );
        await loadSearchFirstPage(page, seed);
        for (const jobId of await collectJobIdsFromResultsList(page)) {
          addLinkedInJobId(found, jobId);
        }
      }
    }
  } else {
    const hrefs = await page.$$eval("a[href]", (anchors) =>
      anchors.map((anchor) => (anchor as HTMLAnchorElement).href),
    );
    for (const href of hrefs) {
      const canonical = canonicalizeJobUrl(href, seed);
      if (canonical) {
        found.add(canonical);
      }
    }
  }

  console.log(`Found ${found.size} job URL(s) on the first page`);
  return [...found];
}

async function extractListingFromPage(
  page: Page,
  url: string,
): Promise<JobListing> {
  await page.goto(url, { waitUntil: "load", timeout: GOTO_TIMEOUT_MS });
  await delay(SETTLE_MS);

  const extracted = await page.evaluate(() => {
    const jsonLd = [
      ...document.querySelectorAll('script[type="application/ld+json"]'),
    ]
      .map((node) => node.textContent ?? "")
      .filter(Boolean);
    const selectors = [
      ".show-more-less-html__markup",
      ".jobs-description",
      "#job-details",
      "[data-testid='job-description']",
      ".job-description",
      "#job-description",
      "article",
      "main",
    ];
    let focused = "";
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (node && (node.textContent?.length ?? 0) > 80) {
        focused = node.textContent ?? "";
        break;
      }
    }
    const heading = document.querySelector("h1")?.textContent?.trim() ?? "";
    const companySelectors = [
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name",
      "a.topcard__org-name-link",
      ".topcard__org-name-link",
    ];
    const companyNames: Array<string> = [];
    for (const selector of companySelectors) {
      const text = document.querySelector(selector)?.textContent?.trim();
      if (text) {
        companyNames.push(text);
      }
    }
    return {
      jsonLd,
      heading,
      focused,
      body: document.body.innerText,
      companyNames,
    };
  });

  const employerNames = [...extracted.companyNames];
  let listing: JobListing = {
    url,
    title: extracted.heading || undefined,
    description: (extracted.focused || extracted.body).slice(0, 20_000),
    skills: [],
  };

  for (const block of extracted.jsonLd) {
    try {
      const posting = findJobPosting(JSON.parse(block));
      if (posting) {
        employerNames.push(...employerNamesFromPosting(posting));
        const fromLd = listingFromJobPosting(posting, url);
        listing = {
          ...listing,
          ...fromLd,
          description: fromLd.description || listing.description,
          title: fromLd.title || listing.title,
        };
        break;
      }
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  }

  listing.company = firstEmployerName(employerNames);
  if (listing.title) {
    listing.title =
      redactEmployerFromTitle(listing.title, employerNames) || listing.title;
  }
  listing.description = redactEmployerNames(
    listing.description ?? "",
    employerNames,
  );
  listing.skills = findKeywordSkills(
    [listing.title, listing.description, listing.skills.join(" ")]
      .filter(Boolean)
      .join(" "),
    webDeveloperKeywords,
  );
  return listing;
}

function uniqueResumeId(base: string, used: Set<string>) {
  let id = base;
  let n = 2;
  while (used.has(id) || BUILTIN_IDS.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

async function writeResumeFile(
  listing: JobListing,
  options: {
    id?: string;
    maxJobs?: number;
    force?: boolean;
    dryRun?: boolean;
    outDir: string;
    importFrom: string;
    usedIds: Set<string>;
    register: boolean;
    searchUrl?: string;
  },
) {
  const baseId = options.id || resumeIdFromJob(listing);
  const id = uniqueResumeId(baseId, options.usedIds);
  const searchUrl = options.searchUrl || listing.searchUrl;
  const tailored = createResumeFromJobListing(listing, {
    id,
    maxJobs: options.maxJobs,
    searchUrl,
    processedAt: processedAtIso(),
  });
  const existingPath = path.join(options.outDir, resumeFileName(tailored.id));
  try {
    await fs.access(existingPath);
    if (!options.force && !options.dryRun) {
      console.warn(`Skip existing ${existingPath} (pass --force to overwrite)`);
      return;
    }
  } catch {
    // File does not exist yet.
  }

  if (options.register) {
    const existing = await getResumeById(tailored.id);
    if (existing && !options.force) {
      throw new Error(
        `Resume id "${tailored.id}" already exists. Pass --id <slug> or --force.`,
      );
    }
  }

  const moduleSource = renderTailoredResumeModule(tailored, {
    importFrom: options.importFrom,
  });
  if (options.dryRun) {
    process.stdout.write(moduleSource);
    return;
  }

  await fs.mkdir(options.outDir, { recursive: true });
  const filePath = path.join(options.outDir, resumeFileName(tailored.id));
  await fs.writeFile(filePath, moduleSource);
  await fs.writeFile(
    path.join(
      options.outDir,
      resumeFileName(tailored.id).replace(/_resume\.ts$/, "_listing.json"),
    ),
    `${JSON.stringify(
      {
        url: listing.url,
        searchUrl: searchUrl ?? null,
        title: listing.title ?? null,
        company: listing.company ?? null,
        skills: listing.skills,
        processedAt: processedAtIso(),
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Wrote ${filePath} ← ${listing.title ?? listing.url}`);
}

async function readSeedUrls(cliUrl?: string) {
  if (cliUrl) {
    return [cliUrl];
  }
  const raw = await fs.readFile(URLS_FILE, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (
    !Array.isArray(parsed) ||
    parsed.some((item) => typeof item !== "string")
  ) {
    throw new Error(`${URLS_FILE} must be a JSON array of URL strings`);
  }
  if (parsed.length === 0) {
    throw new Error(`${URLS_FILE} is empty`);
  }
  return parsed as Array<string>;
}

async function saveJobUrls(seed: string, urls: Array<string>) {
  const dir = scrapedDirFor(seed);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, "urls.json");
  await fs.writeFile(
    filePath,
    `${JSON.stringify(
      {
        source: seed,
        scrapedAt: new Date().toISOString(),
        urls,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Saved ${urls.length} job URL(s) to ${filePath}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const seeds = await readSeedUrls(options.url);
  const batch = !options.url;
  const { chromium } = await import("playwright");
  const userDataDir = path.join(".playwright", "browser");
  await fs.mkdir(userDataDir, { recursive: true });
  const headed = options.headed || process.env.PLAYWRIGHT_HEADED === "1";
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: !headed,
    viewport: { width: 1400, height: 1800 },
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  const usedIds = new Set<string>();

  try {
    for (const seed of seeds) {
      new URL(seed);
      console.log(`Scanning first page: ${seed}`);
      let jobUrls = await collectFirstPageJobUrls(page, seed, headed);
      if (jobUrls.length === 0) {
        jobUrls = [seed];
        console.warn(
          "No job cards found; using the seed URL as a single posting.",
        );
      }

      if (batch) {
        await saveJobUrls(seed, jobUrls);
      }

      for (const [index, jobUrl] of jobUrls.entries()) {
        if (index > 0) {
          await delay(JOB_DELAY_MS);
        }
        console.log(`Scraping ${jobUrl}`);
        try {
          const listing = await extractListingFromPage(page, jobUrl);
          if (!listingLooksLikeAJob(listing)) {
            console.warn(
              `Skip ${jobUrl}: did not look like a job description.`,
            );
            continue;
          }
          await writeResumeFile(listing, {
            id: batch ? undefined : options.id,
            maxJobs: options.maxJobs,
            force: options.force ?? batch,
            dryRun: options.dryRun,
            outDir: scrapedDirFor(seed),
            importFrom: scrapedResumeImportFrom,
            usedIds,
            register: false,
            searchUrl: seed,
          });
        } catch (error) {
          console.warn(
            `Failed ${jobUrl}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }
    }
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
