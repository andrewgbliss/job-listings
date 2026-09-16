import { resumeExportName } from "./from-job-listing";
import { listScrapedFolder } from "./scraped-folder";
import { isScrapedDateFolder } from "./scraped-path";
import type { ResumeDocument } from "./types";

function isResumeDocument(value: unknown): value is ResumeDocument {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as { id?: unknown }).id === "string" &&
    Array.isArray((value as { workExperience?: unknown }).workExperience),
  );
}

function resumeFromModule(
  mod: Record<string, unknown>,
  id: string,
): ResumeDocument | undefined {
  const named = mod[resumeExportName(id)];
  if (isResumeDocument(named)) {
    return named;
  }
  return Object.values(mod).find(isResumeDocument);
}

export async function loadScrapedResumes(): Promise<Array<ResumeDocument>> {
  const items = await listScrapedFolder();
  const resumes: Array<ResumeDocument> = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (!item.hasResume) {
      continue;
    }
    if (
      !isScrapedDateFolder(item.dateFolder) ||
      !/^[\w.-]+$/.test(item.domain) ||
      !/^[\w.-]+$/.test(item.stem)
    ) {
      continue;
    }

    try {
      const mod = (await import(
        /* webpackInclude: /_resume\.ts$/ */
        `../scraped/${item.dateFolder}/${item.domain}/${item.stem}_resume.ts`
      )) as Record<string, unknown>;
      const doc = resumeFromModule(mod, item.id);
      if (doc && !seen.has(doc.id)) {
        seen.add(doc.id);
        resumes.push({
          ...doc,
          company: item.company,
        });
      }
    } catch {
      // Skip missing or invalid generated modules.
    }
  }

  return resumes;
}
