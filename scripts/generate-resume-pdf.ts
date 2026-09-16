/**
 * Render resume and cover-letter pages to letter-size PDFs with Playwright.
 *
 * Start the app first (`npm run dev`), then:
 *
 *   npm run resume:pdf
 *   npm run resume:pdf -- main
 *   npm run resume:pdf -- ai-dev game-dev
 *   npx tsx scripts/generate-resume-pdf.ts --base-url http://localhost:3000 --out public/assets
 */
import fs from "node:fs/promises";
import path from "node:path";
import { getCoverLetterById } from "../src/lib/cover-letter";
import {
  coverLetterPdfFilename,
  resumePdfFilename,
} from "../src/lib/resume";
import {
  getAllResumeIds,
  getResumeById,
} from "../src/lib/job-listings/utils/documents";

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_OUT_DIR = path.join("public", "assets");
const GOTO_TIMEOUT_MS = 45_000;
const SETTLE_MS = 1_000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type GenerateResumePdfOptions = {
  ids?: Array<string>;
  baseUrl?: string;
  outDir?: string;
};

async function printUsage() {
  const ids = await getAllResumeIds();
  console.log(`Usage:
  npm run resume:pdf [-- <id> ...]
  npx tsx scripts/generate-resume-pdf.ts [options] [id ...]

Options:
  --base-url <url>   Site origin (default: ${DEFAULT_BASE_URL} or RESUME_BASE_URL)
  --out <dir>        Output directory (default: ${DEFAULT_OUT_DIR})
  -h, --help         Show this help

Resume ids: ${ids.join(", ")}
With no ids, every resume and cover letter is generated.
`);
}

function parseArgs(argv: Array<string>): GenerateResumePdfOptions & {
  help?: boolean;
} {
  const ids: Array<string> = [];
  let baseUrl = process.env.RESUME_BASE_URL ?? DEFAULT_BASE_URL;
  let outDir = DEFAULT_OUT_DIR;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      return { help: true };
    }
    if (arg === "--base-url") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("--base-url requires a URL");
      }
      baseUrl = value;
      i += 1;
      continue;
    }
    if (arg === "--out") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("--out requires a directory");
      }
      outDir = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    ids.push(arg);
  }

  return { ids, baseUrl, outDir };
}

async function pdfFilenameFor(
  id: string,
  kind: "resume" | "cover-letter",
) {
  const doc = await getResumeById(id);
  const source = {
    name: doc?.name ?? "Resume",
    company: doc?.company,
    jobTitle: doc?.jobTitle,
    tagline: doc?.tagline,
  };
  return kind === "cover-letter"
    ? coverLetterPdfFilename(source)
    : resumePdfFilename(source);
}

function printCss(kind: "resume" | "cover-letter") {
  const articlePadding = kind === "cover-letter" ? "0.25in" : "0";
  return `
  @page {
    size: Letter;
    margin: 0.5in;
  }
  html, body, main {
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
    color-scheme: light !important;
  }
  article {
    display: block !important;
    min-height: 0 !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    padding: ${articlePadding} !important;
  }
  .break-inside-avoid {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    -webkit-column-break-inside: avoid !important;
  }
  nextjs-portal,
  #nextjs-dev-indicator,
  [data-next-badge-root],
  [data-nextjs-toast],
  [data-sonner-toaster] {
    display: none !important;
  }
`;
}

async function launchChromium(chromium: typeof import("playwright").chromium) {
  const attempts: Array<Parameters<typeof chromium.launch>[0]> = [
    { headless: true, channel: "chrome" },
    { headless: true, channel: "chromium" },
    { headless: true },
  ];
  let lastError: unknown;
  for (const options of attempts) {
    try {
      return await chromium.launch(options);
    } catch (error) {
      lastError = error;
    }
  }
  const detail = lastError instanceof Error ? ` ${lastError.message}` : "";
  throw new Error(
    `Could not launch Chrome/Chromium.${detail} Run \`npx playwright install chromium\`.`,
  );
}

async function assertServer(baseUrl: string) {
  try {
    const response = await fetch(baseUrl, { redirect: "manual" });
    if (response.status >= 500) {
      throw new Error(`Server at ${baseUrl} returned ${response.status}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Server at")) {
      throw error;
    }
    throw new Error(
      `Could not reach ${baseUrl}. Start the app with \`npm run dev\` and retry.`,
    );
  }
}

async function markerFor(
  id: string,
  kind: "resume" | "cover-letter",
) {
  if (kind === "cover-letter") {
    const letter = await getCoverLetterById(id);
    const line = letter?.body
      .split("\n")
      .map((item) => item.trim())
      .find((item) => item.length > 40);
    return line?.slice(0, 80) || letter?.position;
  }
  const doc = await getResumeById(id);
  return doc?.backgroundParagraphs?.[0]?.slice(0, 80) || doc?.tagline;
}

async function printPdfPage(
  browser: import("playwright").Browser,
  options: {
    url: string;
    marker?: string;
    outputPath: string;
    kind: "resume" | "cover-letter";
  },
) {
  const page = await browser.newPage({
    viewport: { width: 816, height: 1056 },
    colorScheme: "light",
  });

  try {
    const response = await page.goto(options.url, {
      waitUntil: "load",
      timeout: GOTO_TIMEOUT_MS,
    });
    if (!response || !response.ok()) {
      throw new Error(
        `Failed to load ${options.url} (${response?.status() ?? "no response"})`,
      );
    }

    if (options.marker) {
      await page.waitForFunction(
        (text) => document.body.innerText.includes(text),
        options.marker,
        { timeout: 20_000 },
      );
    }

    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
      return document.fonts.ready;
    });
    await delay(SETTLE_MS);
    await page.addStyleTag({ content: printCss(options.kind) });
    await page.emulateMedia({ media: "print", colorScheme: "light" });

    await page.pdf({
      path: options.outputPath,
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
  } finally {
    await page.close();
  }
}

export async function generateResumePdf(
  options: GenerateResumePdfOptions = {},
): Promise<Array<string>> {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const outDir = path.resolve(options.outDir ?? DEFAULT_OUT_DIR);
  const requested = options.ids?.filter(Boolean) ?? [];
  const knownIds = await getAllResumeIds();
  const ids = requested.length > 0 ? requested : knownIds;

  const unknown = ids.filter((id) => !knownIds.includes(id));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown resume id(s): ${unknown.join(", ")}. Known: ${knownIds.join(", ")}`,
    );
  }

  await assertServer(baseUrl);
  await fs.mkdir(outDir, { recursive: true });

  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error(
      "Playwright is not installed. Run `npm install` then `npx playwright install chromium`.",
    );
  }

  const browser = await launchChromium(chromium);
  const written: Array<string> = [];
  const kinds = ["resume", "cover-letter"] as const;

  try {
    for (const id of ids) {
      for (const kind of kinds) {
        const pathSuffix =
          kind === "cover-letter"
            ? `/resume/${id}/cover-letter`
            : `/resume/${id}`;
        const outputPath = path.join(outDir, await pdfFilenameFor(id, kind));
        await printPdfPage(browser, {
          url: `${baseUrl}${pathSuffix}?pdf=${Date.now()}`,
          marker: await markerFor(id, kind),
          outputPath,
          kind,
        });
        written.push(outputPath);
        console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);
      }
    }
  } finally {
    await browser.close();
  }

  return written;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    await printUsage();
    return;
  }

  await generateResumePdf(parsed);
}

const invokedAsScript = process.argv[1]
  ?.replaceAll("\\", "/")
  .includes("generate-resume-pdf");

if (invokedAsScript) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
