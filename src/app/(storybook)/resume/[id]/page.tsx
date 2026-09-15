import { Header } from "@/app/_components/Header";
import { Resume } from "@/app/_components/Resume";
import { getAllResumeIds, getResumeById } from "@/lib/resume/utils/documents";
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

export async function generateStaticParams() {
  return (await getAllResumeIds()).map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const doc = await getResumeById(id);
  if (!doc) {
    return { title: "Resume not found" };
  }

  const pageUrl = `${website.url}/resume/${doc.id}`;
  const ogTitle = `${doc.name} — ${doc.tagline}`;
  const ogDescription = doc.backgroundParagraphs?.[0] ?? doc.tagline;

  return {
    title: ogTitle,
    description: ogDescription,
    icons: {
      icon: "/favicon.ico",
    },
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      images: [
        {
          url: "andy.jpg",
        },
      ],
      type: "website",
      url: pageUrl,
      siteName: website.name,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: ["andy.jpg"],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function ResumeByIdPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { pdf } = await searchParams;
  const forPdf = pdf !== undefined;
  const doc = await getResumeById(id);
  if (!doc) {
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
          <Header document={doc} key={doc.processedAt ?? doc.id} />
        )}
        <div
          className={
            forPdf
              ? "bg-white text-zinc-950 [--foreground:oklch(0.145_0_0)] [--muted-foreground:oklch(0.4_0_0)]"
              : "min-h-[11in] bg-white text-zinc-950 shadow-[0_1px_8px_rgba(0,0,0,0.08)] print:shadow-none [--foreground:oklch(0.145_0_0)] [--muted-foreground:oklch(0.4_0_0)]"
          }
        >
          <Resume document={doc} forPdf={forPdf} />
        </div>
      </div>
    </main>
  );
}
