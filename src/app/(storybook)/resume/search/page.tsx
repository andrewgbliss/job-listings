import { listRecentSearches } from "@/lib/job-listings/utils/search/cache";
import {
  searchHref,
  searchStoreRelativePath,
} from "@/lib/job-listings/utils/search/types";
import { allResumesHref, scrapedFolderHref } from "@/lib/resume";
import { website } from "@/lib/website";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SearchPanel } from "./search-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Job search — ${website.name}`,
  description: "Search public job feeds and keep the results on disk.",
  alternates: {
    canonical: `${website.url}${searchHref}`,
  },
};

export default async function JobSearchPage() {
  const recent = await listRecentSearches();

  return (
    <main className="min-h-screen w-full bg-zinc-200 px-4 py-6">
      <div className="mx-auto bg-white text-zinc-950 shadow-[0_1px_8px_rgba(0,0,0,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3 sm:px-8">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-zinc-950">Job search</h1>
            <p
              title={searchStoreRelativePath}
              className="truncate font-mono text-xs text-zinc-500"
            >
              {searchStoreRelativePath}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={scrapedFolderHref}
              className="inline-flex items-center gap-2 border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
            >
              Scraped
            </Link>
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
              <ArrowLeft size={16} className="shrink-0 text-zinc-500" aria-hidden />
              Home
            </Link>
          </div>
        </div>
        <SearchPanel recent={recent} />
      </div>
    </main>
  );
}
