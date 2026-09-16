import { cn } from "@/lib/utils";

export function CoverLetter({
  body,
  forPdf = false,
}: {
  body: string;
  forPdf?: boolean;
}) {
  return (
    <article
      className={cn(
        "cover-letter whitespace-pre-wrap px-8 py-8 text-[13.5px] leading-relaxed text-zinc-800 sm:px-12 sm:py-10 print:px-8 print:py-8",
        forPdf ? "block min-h-0 px-8 py-8" : "min-h-full",
      )}
    >
      {body.trim()}
    </article>
  );
}
