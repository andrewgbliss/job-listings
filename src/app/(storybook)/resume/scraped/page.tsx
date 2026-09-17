import { allResumesHref, coverLetterPdfFilename, coverLetterPdfHref, defaultScrapedFolderPath, formatProcessedAt, resume as defaultResume, resumePdfFilename, resumePdfHref, scrapedFolderHref } from "@/lib/resume";
import { listScrapedFolder } from "@/lib/job-listings/utils/scraped-folder";
import { website } from "@/lib/website";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Scraped listings — ${website.name}`,
  description: "Captured job listings from the local scraped folder.",
  alternates: {
    canonical: `${website.url}${scrapedFolderHref}`,
  },
};

function displayUrl(href: string) {
  return href.replace(/^https?:\/\//, "").replace(/^www\./, "");
}

function fileLabels(item: {
  hasHtml: boolean;
  hasListing: boolean;
  hasResume: boolean;
  hasCoverLetter: boolean;
}) {
  const parts = [
    item.hasHtml ? "html" : null,
    item.hasListing ? "json" : null,
    item.hasResume ? "resume" : null,
    item.hasCoverLetter ? "letter" : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export default async function ScrapedFolderPage() {
  const scrapes = await listScrapedFolder();

  return (
    <main className="min-h-screen w-full bg-zinc-200 px-4 py-6">
      <div className="mx-auto bg-white text-zinc-950 shadow-[0_1px_8px_rgba(0,0,0,0.08)] [--foreground:oklch(0.145_0_0)] [--muted-foreground:oklch(0.4_0_0)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3 sm:px-8">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-zinc-950">Scraped</h1>
            <p
              title={defaultScrapedFolderPath}
              className="truncate font-mono text-xs text-zinc-500"
            >
              {defaultScrapedFolderPath}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={allResumesHref}
              className="inline-flex items-center gap-2 border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
            >
              All resumes
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
            >
              <ArrowLeft
                size={16}
                className="shrink-0 text-zinc-500"
                aria-hidden
              />
              Home
            </Link>
          </div>
        </div>

        <div className="px-5 py-4 sm:px-8 sm:py-6">
          {scrapes.length === 0 ? (
            <p className="text-sm text-zinc-600">No scrapes in this folder yet.</p>
          ) : (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[11%] text-zinc-700">Date</TableHead>
                  <TableHead className="w-[11%] text-zinc-700">Domain</TableHead>
                  <TableHead className="w-[13%] text-zinc-700">Scrape</TableHead>
                  <TableHead className="w-[13%] text-zinc-700">Company</TableHead>
                  <TableHead className="w-[13%] text-zinc-700">Title</TableHead>
                  <TableHead className="w-[15%] text-zinc-700">Listing</TableHead>
                  <TableHead className="w-[12%] text-zinc-700">Files</TableHead>
                  <TableHead className="w-[6%] text-right text-zinc-700">Resume</TableHead>
                  <TableHead className="w-[6%] text-right text-zinc-700">Letter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scrapes.map((scrape) => {
                  const listing = scrape.sourceUrl
                    ? displayUrl(scrape.sourceUrl)
                    : undefined;
                  const pdfSource = {
                    name: defaultResume.name,
                    company: scrape.company,
                    jobTitle: scrape.title,
                  };
                  return (
                    <TableRow key={scrape.relativePath}>
                      <TableCell className="tabular-nums text-zinc-700">
                        {formatProcessedAt(scrape.processedAt ?? scrape.dateFolder)}
                      </TableCell>
                      <TableCell
                        title={scrape.domain}
                        className="max-w-0 truncate text-zinc-700"
                      >
                        {scrape.domain}
                      </TableCell>
                      <TableCell className="max-w-0 font-medium text-zinc-950">
                        {scrape.resumeHref ? (
                          <Link
                            href={scrape.resumeHref}
                            title={scrape.id}
                            className="block truncate hover:underline"
                          >
                            {scrape.id}
                          </Link>
                        ) : (
                          <span title={scrape.id} className="block truncate">
                            {scrape.id}
                          </span>
                        )}
                      </TableCell>
                      <TableCell
                        title={scrape.company}
                        className="max-w-0 truncate text-zinc-700"
                      >
                        {scrape.company || "—"}
                      </TableCell>
                      <TableCell
                        title={scrape.title ?? undefined}
                        className="max-w-0 truncate text-zinc-700"
                      >
                        {scrape.title || "—"}
                      </TableCell>
                      <TableCell className="max-w-0 text-zinc-600">
                        {scrape.sourceUrl && listing ? (
                          <a
                            href={scrape.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            title={listing}
                            className="block truncate hover:text-zinc-950 hover:underline"
                          >
                            {listing}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell
                        title={fileLabels(scrape)}
                        className="max-w-0 truncate text-zinc-600"
                      >
                        {fileLabels(scrape)}
                      </TableCell>
                      <TableCell className="text-right">
                        {scrape.resumeHref ? (
                          <>
                            <Link
                              href={scrape.resumeHref}
                              className="font-medium text-zinc-950 hover:underline"
                            >
                              View
                            </Link>
                            <span className="text-zinc-400"> · </span>
                            <a
                              href={resumePdfHref(pdfSource)}
                              download={resumePdfFilename(pdfSource)}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-zinc-950 hover:underline"
                            >
                              PDF
                            </a>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {scrape.coverLetterHref ? (
                          <>
                            <Link
                              href={scrape.coverLetterHref}
                              className="font-medium text-zinc-950 hover:underline"
                            >
                              View
                            </Link>
                            <span className="text-zinc-400"> · </span>
                            <a
                              href={coverLetterPdfHref(pdfSource)}
                              download={coverLetterPdfFilename(pdfSource)}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-zinc-950 hover:underline"
                            >
                              PDF
                            </a>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </main>
  );
}
