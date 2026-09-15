"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DEFAULT_RESUME_ID,
  allResumesHref,
  isBuiltinResume,
  scrapedFolderHref,
  type ResumeDocument,
} from "@/lib/resume";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  FolderOpen,
  Menu,
  RefreshCw,
  Search,
  Table2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const monthYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

function toDate(value: Date) {
  return value instanceof Date ? value : new Date(value);
}

function formatMonthYear(date: Date) {
  return monthYearFormatter.format(toDate(date));
}

function isCurrentMonth(date: Date) {
  const now = new Date();
  const value = toDate(date);
  return (
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth()
  );
}

function formatDateRange(from: Date, to: Date, allowPresent = false) {
  const start = formatMonthYear(from);
  if (allowPresent && isCurrentMonth(to)) {
    return `${start} – Present`;
  }
  return `${start} – ${formatMonthYear(to)}`;
}

function uniqueSkills(document: ResumeDocument) {
  return [...new Set(document.workExperience.flatMap((work) => work.skills))];
}

function pdfHref(document: ResumeDocument) {
  const filename =
    document.id === DEFAULT_RESUME_ID
      ? `${document.name} - Resume.pdf`
      : `${document.name} - ${document.id} Resume.pdf`;
  return `/assets/${encodeURIComponent(filename)}`;
}

function displayLink(href: string) {
  try {
    const url = new URL(href);
    const host = url.hostname.replace(/^www\./, "");
    const path = url.pathname.replace(/\/$/, "");
    return `${host}${path}`;
  } catch {
    return href;
  }
}

function SectionHeading({
  children,
  id,
}: {
  children: string;
  id: string;
}) {
  return (
    <h2
      id={id}
      className="mb-2 border-b border-zinc-800 pb-0.5 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-900"
    >
      {children}
    </h2>
  );
}

export function Resume({ document }: { document: ResumeDocument }) {
  const router = useRouter();
  const [resyncing, setResyncing] = useState(false);
  const canResync = !isBuiltinResume(document.id);
  const skills = uniqueSkills(document);
  const contact = [
    `${document.address.city}, ${document.address.state}`,
    document.email,
    document.phone,
  ];

  async function resyncResume() {
    if (resyncing) {
      return;
    }
    setResyncing(true);
    try {
      const response = await fetch("/api/resync-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: document.id }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const error =
        payload &&
        typeof payload === "object" &&
        typeof (payload as { error?: unknown }).error === "string"
          ? (payload as { error: string }).error
          : `Resync failed (${response.status})`;
      if (!response.ok) {
        toast.error(error);
        return;
      }
      const pdfFailed =
        payload &&
        typeof payload === "object" &&
        (payload as { pdf?: { ok?: unknown } }).pdf?.ok === false;
      toast.success(
        pdfFailed
          ? "Resume tailoring updated. PDF generation failed."
          : "Resume resynced.",
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Resync failed");
    } finally {
      setResyncing(false);
    }
  }

  return (
    <div className="w-full">
      <div className="print:hidden flex justify-end border-b border-zinc-200 bg-white px-5 py-3 sm:px-8">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              aria-label="Resume menu"
              className="border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50"
            >
              {resyncing ? (
                <RefreshCw className="animate-spin" />
              ) : (
                <Menu />
              )}
              {resyncing ? "Resyncing…" : "Menu"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-52 border-zinc-200 bg-white text-zinc-950 shadow-md"
          >
            <DropdownMenuItem
              disabled={resyncing || !canResync}
              onSelect={() => {
                if (!canResync) {
                  return;
                }
                void resyncResume();
              }}
            >
              <RefreshCw className={resyncing ? "animate-spin" : ""} />
              {resyncing ? "Resyncing…" : "Resync"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => window.open(pdfHref(document), "_blank")}
            >
              <FileText />
              PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push(allResumesHref)}>
              <Table2 />
              All resumes
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push(scrapedFolderHref)}>
              <FolderOpen />
              Scraped
            </DropdownMenuItem>
            {document.sourceUrl && (
              <DropdownMenuItem
                onSelect={() =>
                  window.open(document.sourceUrl, "_blank", "noopener,noreferrer")
                }
              >
                <ExternalLink />
                Job listing
              </DropdownMenuItem>
            )}
            {document.searchUrl && document.searchUrl !== document.sourceUrl && (
              <DropdownMenuItem
                onSelect={() =>
                  window.open(document.searchUrl, "_blank", "noopener,noreferrer")
                }
              >
                <Search />
                Search
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/")}>
              <ArrowLeft />
              Home
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <article className="px-6 py-7 text-zinc-800 sm:px-10 sm:py-8 print:px-8 print:py-0">
        <header className="border-b border-zinc-800 pb-3 text-center">
          <h1 className="text-[1.85rem] font-bold leading-none tracking-tight text-zinc-950 sm:text-[2rem]">
            {document.name}
          </h1>
          <p className="mt-1.5 text-sm font-medium text-zinc-600">
            {document.tagline}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
            {contact.map((item, index) => (
              <span key={item}>
                {index > 0 && (
                  <span className="px-1.5 text-zinc-400" aria-hidden>
                    ·
                  </span>
                )}
                {item.includes("@") ? (
                  <a
                    href={`mailto:${item}`}
                    className="hover:text-zinc-950 hover:underline"
                  >
                    {item}
                  </a>
                ) : item.startsWith("+") ? (
                  <a
                    href={`tel:${item.replace(/\s+/g, "")}`}
                    className="hover:text-zinc-950 hover:underline"
                  >
                    {item}
                  </a>
                ) : (
                  item
                )}
              </span>
            ))}
          </p>
          {document.links.length > 0 && (
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">
              {document.links.map((href, index) => (
                <span key={href}>
                  {index > 0 && (
                    <span className="px-1.5 text-zinc-400" aria-hidden>
                      ·
                    </span>
                  )}
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-zinc-950 hover:underline"
                  >
                    {displayLink(href)}
                  </a>
                </span>
              ))}
            </p>
          )}
        </header>

        {document.backgroundParagraphs &&
          document.backgroundParagraphs.length > 0 && (
            <section className="mt-5" aria-labelledby="summary-heading">
              <SectionHeading id="summary-heading">Summary</SectionHeading>
              <div className="space-y-2 text-[13.5px] leading-relaxed text-zinc-700">
                {document.backgroundParagraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          )}

        {skills.length > 0 && (
          <section className="mt-5" aria-labelledby="skills-heading">
            <SectionHeading id="skills-heading">Skills</SectionHeading>
            <p className="text-[13.5px] leading-relaxed text-zinc-700">
              {skills.join(" · ")}
            </p>
          </section>
        )}

        <section className="mt-5" aria-labelledby="experience-heading">
          <SectionHeading id="experience-heading">Experience</SectionHeading>
          <ul className="m-0 flex list-none flex-col gap-4 p-0 print:block print:space-y-4">
            {document.workExperience.map((work, i) => (
              <li key={`${work.company}-${i}`} className="min-w-0 break-inside-avoid">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold leading-snug text-zinc-950">
                      {work.company}
                      <span className="font-normal text-zinc-500">
                        {" · "}
                        {work.location.city}, {work.location.state}
                      </span>
                    </h3>
                  </div>
                  <p className="shrink-0 text-[13px] tabular-nums text-zinc-600">
                    {formatDateRange(work.from, work.to, true)}
                  </p>
                </div>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13.5px] leading-snug text-zinc-700">
                  {work.bulletpoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                {work.skills.length > 0 && (
                  <p className="mt-1.5 text-[12px] leading-snug text-zinc-500">
                    {work.skills.join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-5" aria-labelledby="education-heading">
          <SectionHeading id="education-heading">Education</SectionHeading>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <p className="text-[15px] leading-snug text-zinc-800">
              <span className="font-semibold text-zinc-950">
                {document.education.school}
              </span>
              <span className="text-zinc-500">
                {" · "}
                {document.education.name}
              </span>
            </p>
            <p className="shrink-0 text-[13px] tabular-nums text-zinc-600">
              {formatDateRange(
                document.education.from,
                document.education.to,
              )}
            </p>
          </div>
        </section>
      </article>
    </div>
  );
}
