"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RecentSearch, SearchResult } from "@/lib/job-listings/utils/search/types";

function websiteHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatWhen(value?: string) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SearchPanel({ recent }: { recent: Array<RecentSearch> }) {
  const router = useRouter();
  const [query, setQuery] = useState(recent[0]?.query ?? "");
  const [zip, setZip] = useState(recent[0]?.zip ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);

  async function search(nextQuery: string, refresh = false, nextZip = zip) {
    const trimmed = nextQuery.trim();
    const trimmedZip = nextZip.trim();
    setQuery(trimmed);
    setZip(trimmedZip);
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/job-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, zip: trimmedZip, refresh }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          payload &&
          typeof payload === "object" &&
          typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "Search failed";
        setError(message);
        return;
      }
      setResult(payload as SearchResult);
      router.refresh();
    } catch {
      setError("Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-5 py-4 sm:px-8 sm:py-6">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void search(query);
        }}
      >
        <label className="min-w-[16rem] flex-1 text-sm text-zinc-700">
          Skill or job title
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="senior react engineer"
            className="mt-1 h-9 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-500"
          />
        </label>
        <label className="w-28 text-sm text-zinc-700">
          Zip code
          <input
            value={zip}
            onChange={(event) => setZip(event.target.value)}
            placeholder="84101"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={10}
            className="mt-1 h-9 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-500"
          />
        </label>
        <button
          type="submit"
          disabled={loading || query.trim().length < 2}
          className="h-9 border border-zinc-900 bg-zinc-900 px-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
        <button
          type="button"
          disabled={loading || query.trim().length < 2}
          onClick={() => void search(query, true)}
          className="h-9 border border-zinc-300 px-3 text-sm font-medium text-zinc-800 disabled:opacity-50"
        >
          Refresh
        </button>
      </form>
      <p className="mt-2 text-sm text-zinc-600">
        The same skill and zip are kept for 12 hours. Refresh rebuilds that file, and a feed
        download is reused for 6 hours. Google, LinkedIn, and Indeed open with that zip.
      </p>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {result ? (
        <div className="mt-5">
          <p className="text-sm text-zinc-600">
            {result.listings.length} listing
            {result.listings.length === 1 ? "" : "s"}
            {result.place
              ? ` near ${result.place.city}, ${result.place.stateAbbr} ${result.place.zip}`
              : result.zip
                ? ` near ${result.zip}`
                : ""}
            {result.fromCache ? " from cache" : " saved"} · {formatWhen(result.fetchedAt)}
            {" · "}
            reuse until {formatWhen(result.expiresAt)}
          </p>
          <p className="mt-1 truncate font-mono text-xs text-zinc-500" title={result.cacheFile}>
            {result.cacheFile}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {result.manualLinks.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener"
                className="border border-zinc-300 px-2.5 py-1 text-sm text-zinc-800 hover:bg-zinc-50"
              >
                Open {link.label}
              </a>
            ))}
          </div>

          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
            {result.sources.map((source) => (
              <li key={source.id}>
                <a href={source.creditUrl} target="_blank" rel="noopener" className="hover:underline">
                  {source.label}
                </a>
                {source.ok
                  ? ` · ${source.matchCount}${source.fromCache ? " cached" : ""}`
                  : ` · ${source.error ?? "failed"}`}
              </li>
            ))}
          </ul>

          {result.listings.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600">
              No listings matched this search in the saved feeds.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-700">
                    <th className="py-2 pr-3 font-medium">Posted</th>
                    <th className="py-2 pr-3 font-medium">Website</th>
                    <th className="py-2 pr-3 font-medium">Company</th>
                    <th className="py-2 pr-3 font-medium">Title</th>
                    <th className="py-2 pr-3 font-medium">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {result.listings.map((item) => (
                    <tr key={`${item.source}-${item.id}`} className="border-b border-zinc-100">
                      <td className="py-2 pr-3 align-top whitespace-nowrap text-zinc-600">
                        {formatWhen(item.publishedAt)}
                      </td>
                      <td className="py-2 pr-3 align-top whitespace-nowrap">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener"
                          title={item.sourceLabel}
                          className="text-zinc-800 hover:underline"
                        >
                          {websiteHost(item.url)}
                        </a>
                      </td>
                      <td className="max-w-[10rem] truncate py-2 pr-3 align-top text-zinc-700" title={item.company}>
                        {item.company}
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener"
                          className="font-medium text-zinc-950 hover:underline"
                        >
                          {item.title}
                        </a>
                        {item.salary ? (
                          <span className="mt-0.5 block text-xs text-zinc-500">{item.salary}</span>
                        ) : null}
                      </td>
                      <td className="max-w-[12rem] truncate py-2 pr-3 align-top text-zinc-600" title={item.location}>
                        {item.location || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : recent.length > 0 ? (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-zinc-800">Saved searches</h2>
          <ul className="mt-2 divide-y divide-zinc-100 border-y border-zinc-100">
            {recent.map((item) => (
              <li key={item.cacheFile} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <button
                  type="button"
                  onClick={() => void search(item.query, false, item.zip ?? "")}
                  className="text-left text-sm font-medium text-zinc-950 hover:underline"
                >
                  {item.query}
                  {item.zip ? ` · ${item.zip}` : ""}
                </button>
                <span className="text-xs text-zinc-500">
                  {item.listingCount} listings · {formatWhen(item.fetchedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-zinc-600">
          Results land in the store folder with the time they were fetched.
        </p>
      )}
    </div>
  );
}
