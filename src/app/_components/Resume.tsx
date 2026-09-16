import type { ResumeDocument } from "@/lib/resume";
import { sortSkillsByWeight } from "@/lib/job-listings/utils/keywords";
import { cn } from "@/lib/utils";

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
  const seen = new Set<string>();
  const ordered: Array<string> = [];
  const max = Math.max(
    0,
    ...document.workExperience.map((work) => work.skills.length),
  );
  for (let index = 0; index < max; index += 1) {
    for (const work of document.workExperience) {
      const skill = work.skills[index];
      if (!skill || seen.has(skill)) {
        continue;
      }
      seen.add(skill);
      ordered.push(skill);
    }
  }
  return ordered;
}

function displaySkills(document: ResumeDocument) {
  if (document.skills) {
    return sortSkillsByWeight(document.skills);
  }
  return sortSkillsByWeight(uniqueSkills(document));
}

function skillIsMatched(skill: string, matched?: Array<string>) {
  if (!matched?.length) {
    return false;
  }
  const key = skill.toLowerCase().replace(/\s+/g, " ").trim();
  return matched.some(
    (item) => item.toLowerCase().replace(/\s+/g, " ").trim() === key,
  );
}

function WorkSkills({
  skills,
  matchedSkills,
}: {
  skills: Array<string>;
  matchedSkills?: Array<string>;
}) {
  return (
    <p className="mt-1 text-[12px] leading-snug text-zinc-500">
      {skills.map((skill, index) => (
        <span key={`${skill}-${index}`}>
          {index > 0 && " · "}
          {
            skill
          }
        </span>
      ))}
    </p>
  );
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

function ResumeLinks({ links }: { links: Array<string> }) {
  if (links.length === 0) {
    return null;
  }

  return (
    <p className="text-[13px] leading-relaxed text-zinc-600">
      {links.map((href, index) => (
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
  );
}

function SectionHeading({ children, id }: { children: string; id: string }) {
  return (
    <h2
      id={id}
      className="mb-1.5 border-b border-zinc-800 pb-0.5 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-900"
    >
      {children}
    </h2>
  );
}

export function Resume({
  document,
  forPdf = false,
}: {
  document: ResumeDocument;
  forPdf?: boolean;
}) {
  const skills = displaySkills(document);
  const contact = [
    `${document.address.city}, ${document.address.state}`,
    document.email,
    document.phone,
  ];
  const sectionGap = forPdf ? "mt-3" : "mt-5";

  return (
    <article
      className={cn(
        "text-zinc-800",
        forPdf
          ? "block min-h-0 px-0 py-0"
          : "flex min-h-full flex-col px-6 py-7 sm:px-10 sm:py-8 print:block print:min-h-0 print:px-0 print:py-0",
      )}
    >
      <header className="pb-0.5 text-center">
        <h1 className="text-[1.85rem] font-bold leading-none tracking-tight text-zinc-950 sm:text-[2rem]">
          {document.name}
        </h1>
        <p className="mt-1.5 text-sm font-medium text-zinc-600">
          {document.tagline}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-600">
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
        <div className="mt-0.5">
          <ResumeLinks links={document.links} />
        </div>
      </header>

      {document.backgroundParagraphs &&
        document.backgroundParagraphs.length > 0 && (
          <section className={sectionGap} aria-labelledby="summary-heading">
            <SectionHeading id="summary-heading">Summary</SectionHeading>
            <div className="space-y-1.5 text-[13.5px] leading-relaxed text-zinc-700">
              {document.backgroundParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        )}

      {skills.length > 0 && (
        <section className={sectionGap} aria-labelledby="skills-heading">
          <SectionHeading id="skills-heading">Skills</SectionHeading>
          <p className="text-[13.5px] leading-relaxed text-zinc-700">
            {skills.join(" · ")}
          </p>
        </section>
      )}

      <section className={sectionGap} aria-labelledby="experience-heading">
        <SectionHeading id="experience-heading">Experience</SectionHeading>
        {/* Divs (not flex/li) so Chromium PDF respects break-inside-avoid. */}
        <div className={cn("m-0 pt-2", forPdf ? "space-y-2.5" : "space-y-4")}>
          {document.workExperience.map((work, i) => (
            <div
              key={`${work.company}-${i}`}
              className="min-w-0 break-inside-avoid"
              style={{
                breakInside: "avoid",
                pageBreakInside: "avoid",
              }}
            >
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
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13.5px] leading-snug text-zinc-700">
                {work.bulletpoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              {work.skills.length > 0 && (
                <WorkSkills
                  skills={work.skills}
                  matchedSkills={work.matchedSkills}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      <section
        className={cn(sectionGap, "break-inside-avoid")}
        style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
        aria-labelledby="education-heading"
      >
        <SectionHeading id="education-heading">Education</SectionHeading>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 pt-2">
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
            {formatDateRange(document.education.from, document.education.to)}
          </p>
        </div>
      </section>

      {document.links.length > 0 && !forPdf && (
        <footer className="mt-auto pt-8 text-center print:hidden">
          <ResumeLinks links={document.links} />
        </footer>
      )}
    </article>
  );
}
