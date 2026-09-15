import { aiDevResume } from "./ai_dev_resume";
import { gameDevResume } from "./game_dev_resume";
import { mainResume } from "./main_resume";
import type { ResumeDocument } from "./types";

export type {
  Address,
  Education,
  ResumeDocument,
  ResumeOptions,
  WorkExperience,
} from "./types";

export const builtinResumeDocuments: Array<ResumeDocument> = [
  mainResume,
  aiDevResume,
  gameDevResume,
];

/** Default resume id and canonical `/resume` redirect target. */
export const DEFAULT_RESUME_ID = mainResume.id;

export const defaultResumeHref = `/resume/${DEFAULT_RESUME_ID}` as const;

/** Backward-compatible export: primary (software) resume content + metadata. */
export const resume: ResumeDocument = mainResume;

export const allResumesHref = "/resume/all" as const;

export {
  defaultScrapedFolderPath,
  formatProcessedAt,
  scrapedFolderHref,
} from "./utils/scraped-path";

export function isBuiltinResume(id: string) {
  return builtinResumeDocuments.some((resume) => resume.id === id);
}

export function resumeDisplayName(doc: ResumeDocument) {
  if (doc.id === "ai-dev") return "AI";
  if (doc.id === "game-dev") return "Game Dev";
  if (doc.id === DEFAULT_RESUME_ID) return "Software";
  return doc.tagline ?? doc.id;
}
