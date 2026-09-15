import { Resume } from "@/app/_components/Resume";
import { getAllResumeIds, getResumeById } from "@/lib/resume";
import { website } from "@/lib/website";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamicParams = false;

export const viewport: Viewport = {
  themeColor: "#d4d4d8",
};

export async function generateStaticParams() {
  return getAllResumeIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const doc = getResumeById(id);
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

export default async function ResumeByIdPage({ params }: PageProps) {
  const { id } = await params;
  const doc = getResumeById(id);
  if (!doc) {
    notFound();
  }

  return (
    <main className="min-h-screen w-full bg-zinc-200 px-4 py-6 print:bg-white print:min-h-0 print:p-0">
      <div className="mx-auto h-[11in] w-full max-w-[8.5in] overflow-auto bg-white text-zinc-950 shadow-[0_1px_8px_rgba(0,0,0,0.08)] print:mx-0 print:h-auto print:max-h-none print:max-w-none print:overflow-visible print:shadow-none [--foreground:oklch(0.145_0_0)] [--muted-foreground:oklch(0.4_0_0)]">
        <Resume document={doc} />
      </div>
    </main>
  );
}
