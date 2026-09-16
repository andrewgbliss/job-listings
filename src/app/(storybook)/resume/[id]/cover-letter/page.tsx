import { Header } from "@/app/_components/Header";
import { CoverLetter } from "@/app/_components/CoverLetter";
import { getCoverLetterById } from "@/lib/cover-letter";
import { getResumeById } from "@/lib/job-listings/utils/documents";
import { website } from "@/lib/website";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pdf?: string }>;
};

export const dynamicParams = true;

export const viewport: Viewport = {
  themeColor: "#d4d4d8",
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const letter = await getCoverLetterById(id);
  if (!letter) {
    return { title: "Cover letter not found" };
  }

  const ogTitle = `${letter.position} — Cover letter`;
  const ogDescription = letter.body.split("\n").find((line) => line.trim()) ?? ogTitle;

  return {
    title: ogTitle,
    description: ogDescription,
    robots: {
      index: false,
      follow: false,
    },
    alternates: {
      canonical: `${website.url}/resume/${letter.id}/cover-letter`,
    },
  };
}

export default async function CoverLetterByIdPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { pdf } = await searchParams;
  const forPdf = pdf !== undefined;
  const [letter, doc] = await Promise.all([
    getCoverLetterById(id),
    getResumeById(id),
  ]);
  if (!letter || !doc) {
    notFound();
  }

  return (
    <main
      className={
        forPdf
          ? "min-h-0 w-full bg-white p-0 text-zinc-950"
          : "min-h-screen w-full bg-zinc-200 px-4 py-6 print:bg-white print:min-h-0 print:p-0"
      }
    >
      <div
        className={
          forPdf
            ? "mx-auto w-full max-w-none"
            : "mx-auto w-full max-w-[8.5in] print:max-w-none"
        }
      >
        {forPdf ? null : (
          <Header
            document={doc}
            active="cover-letter"
            key={doc.processedAt ?? doc.id}
          />
        )}
        <div
          className={
            forPdf
              ? "bg-white text-zinc-950 [--foreground:oklch(0.145_0_0)] [--muted-foreground:oklch(0.4_0_0)]"
              : "min-h-[11in] bg-white text-zinc-950 shadow-[0_1px_8px_rgba(0,0,0,0.08)] print:shadow-none [--foreground:oklch(0.145_0_0)] [--muted-foreground:oklch(0.4_0_0)]"
          }
        >
          <CoverLetter body={letter.body} forPdf={forPdf} />
        </div>
      </div>
    </main>
  );
}
