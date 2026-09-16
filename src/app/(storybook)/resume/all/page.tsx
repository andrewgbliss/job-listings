import {
  allResumesHref,
  coverLetterHref,
  coverLetterPdfFilename,
  coverLetterPdfHref,
  formatProcessedAt,
  isBuiltinResume,
  resumeDisplayName,
  resumePdfFilename,
  resumePdfHref,
  scrapedFolderHref,
} from "@/lib/resume";
import { getResumeDocuments } from "@/lib/job-listings/utils/documents";
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

export const metadata: Metadata = {
  title: `Resumes — ${website.name}`,
  description: "All resume versions, including job-tailored copies.",
  alternates: {
    canonical: `${website.url}${allResumesHref}`,
  },
};

export const dynamic = "force-dynamic";

export default async function AllResumesPage() {
  const resumeDocuments = await getResumeDocuments();

  return (
    <main className="min-h-screen w-full bg-zinc-200 px-4 py-6">
      <div className="mx-auto max-w-5xl bg-white text-zinc-950 shadow-[0_1px_8px_rgba(0,0,0,0.08)] [--foreground:oklch(0.145_0_0)] [--muted-foreground:oklch(0.4_0_0)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3 sm:px-8">
          <h1 className="text-lg font-semibold text-zinc-950">All resumes</h1>
          <div className="flex items-center gap-2">
            <Link
              href={scrapedFolderHref}
              className="inline-flex items-center gap-2 border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
            >
              Scraped
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
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[13%] text-zinc-700">Resume</TableHead>
                <TableHead className="w-[13%] text-zinc-700">Company</TableHead>
                <TableHead className="w-[16%] text-zinc-700">Role</TableHead>
                <TableHead className="w-[8%] text-zinc-700">Type</TableHead>
                <TableHead className="w-[13%] text-zinc-700">
                  Processed
                </TableHead>
                <TableHead className="w-[14%] text-zinc-700">Listing</TableHead>
                <TableHead className="w-[6%] text-zinc-700">Search</TableHead>
                <TableHead className="w-[5%] text-right text-zinc-700">
                  Jobs
                </TableHead>
                <TableHead className="w-[6%] text-right text-zinc-700">
                  Open
                </TableHead>
                <TableHead className="w-[6%] text-right text-zinc-700">
                  Letter
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumeDocuments.map((resume) => {
                const name = resumeDisplayName(resume);
                const listing = resume.sourceUrl
                  ?.replace(/^https?:\/\//, "")
                  .replace(/^www\./, "");
                return (
                  <TableRow key={resume.id}>
                    <TableCell className="max-w-0 font-medium text-zinc-950">
                      <Link
                        href={`/resume/${resume.id}`}
                        title={name}
                        className="block truncate hover:underline"
                      >
                        {name}
                      </Link>
                    </TableCell>
                    <TableCell
                      title={resume.company}
                      className="max-w-0 truncate text-zinc-700"
                    >
                      {resume.company || "—"}
                    </TableCell>
                    <TableCell
                      title={resume.tagline}
                      className="max-w-0 truncate text-zinc-700"
                    >
                      {resume.tagline}
                    </TableCell>
                    <TableCell className="text-zinc-600">
                      {isBuiltinResume(resume.id) ? "Built-in" : "Tailored"}
                    </TableCell>
                    <TableCell
                      title={resume.processedAt}
                      className="max-w-0 truncate tabular-nums text-zinc-600"
                    >
                      {formatProcessedAt(resume.processedAt)}
                    </TableCell>
                    <TableCell className="max-w-0 text-zinc-600">
                      {resume.sourceUrl && listing ? (
                        <a
                          href={resume.sourceUrl}
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
                    <TableCell className="truncate text-zinc-600">
                      {resume.searchUrl &&
                      resume.searchUrl !== resume.sourceUrl ? (
                        <a
                          href={resume.searchUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-zinc-950 hover:underline"
                        >
                          Search
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-600">
                      {resume.workExperience.length}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/resume/${resume.id}`}
                        className="font-medium text-zinc-950 hover:underline"
                      >
                        View
                      </Link>
                      <span className="text-zinc-400"> · </span>
                      <a
                        href={resumePdfHref(resume)}
                        download={resumePdfFilename(resume)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-zinc-950 hover:underline"
                      >
                        PDF
                      </a>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={coverLetterHref(resume.id)}
                        className="font-medium text-zinc-950 hover:underline"
                      >
                        View
                      </Link>
                      <span className="text-zinc-400"> · </span>
                      <a
                        href={coverLetterPdfHref(resume)}
                        download={coverLetterPdfFilename(resume)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-zinc-950 hover:underline"
                      >
                        PDF
                      </a>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}
