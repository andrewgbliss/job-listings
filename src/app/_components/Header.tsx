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
  allResumesHref,
  coverLetterHref,
  coverLetterPdfFilename,
  coverLetterPdfHref,
  isBuiltinResume,
  resumePdfFilename,
  resumePdfHref,
  scrapedFolderHref,
  type ResumeDocument,
} from "@/lib/resume";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Mail,
  Menu,
  RefreshCw,
  RotateCw,
  Search,
  Table2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function downloadPdf(href: string, filename: string) {
  const link = document.createElement("a");
  link.href = `${href}?t=${Date.now()}`;
  link.download = filename;
  link.rel = "noreferrer";
  document.body.append(link);
  link.click();
  link.remove();
}

export function Header({
  document,
  active = "resume",
}: {
  document: ResumeDocument;
  active?: "resume" | "cover-letter";
}) {
  const router = useRouter();
  const [resyncing, setResyncing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const canResync = !isBuiltinResume(document.id);
  const busy = resyncing || generatingPdf;

  useEffect(() => {
    setResyncing(false);
    setGeneratingPdf(false);
  }, [document.id, document.processedAt]);

  async function resyncResume() {
    if (busy) {
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
      toast.success("Resume and cover letter resynced.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Resync failed");
    } finally {
      setResyncing(false);
    }
  }

  async function regeneratePdfs() {
    if (busy) {
      return;
    }
    setGeneratingPdf(true);
    try {
      const response = await fetch("/api/generate-pdf", {
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
          : `PDF generation failed (${response.status})`;
      if (!response.ok) {
        toast.error(error);
        return;
      }
      toast.success("Resume and cover letter PDFs regenerated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "PDF generation failed",
      );
    } finally {
      setGeneratingPdf(false);
    }
  }

  return (
    <header className="sticky top-0 z-20 mb-3 flex justify-end bg-zinc-200 py-3 print:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            aria-label="Resume menu"
            className="border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50"
          >
            {busy ? (
              <RefreshCw className="animate-spin" />
            ) : (
              <Menu />
            )}
            {resyncing
              ? "Resyncing…"
              : generatingPdf
                ? "Generating…"
                : "Menu"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-52 border-zinc-200 bg-white text-zinc-950 shadow-md"
        >
          <DropdownMenuItem
            disabled={busy || !canResync}
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
            disabled={busy}
            onSelect={() => {
              void regeneratePdfs();
            }}
          >
            <RotateCw className={generatingPdf ? "animate-spin" : ""} />
            {generatingPdf ? "Generating PDFs…" : "Regenerate PDFs"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              downloadPdf(resumePdfHref(document), resumePdfFilename(document))
            }
          >
            <Download />
            Resume PDF
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              downloadPdf(
                coverLetterPdfHref(document),
                coverLetterPdfFilename(document),
              )
            }
          >
            <Download />
            Cover letter PDF
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => router.push(`/resume/${document.id}`)}
          >
            <FileText />
            Resume
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => router.push(coverLetterHref(document.id))}
          >
            <Mail />
            Cover letter
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
    </header>
  );
}
