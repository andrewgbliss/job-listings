import { aiDevResume } from "./ai_dev_resume";
import { gameDevResume } from "./game_dev_resume";
import { mainResume } from "./main_resume";
import type { ResumeDocument } from "../job-listings/utils/types";

export type {
  Address,
  Education,
  ResumeDocument,
  ResumeOptions,
  WorkExperience,
} from "../job-listings/utils/types";

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
} from "../job-listings/utils/scraped-path";

export function coverLetterHref(id: string) {
  return `/resume/${id}/cover-letter` as const;
}

export function resumePdfFilename(id: string, name: string) {
  return id === DEFAULT_RESUME_ID
    ? `${name} - Resume.pdf`
    : `${name} - ${id} Resume.pdf`;
}

export function coverLetterPdfFilename(id: string, name: string) {
  return id === DEFAULT_RESUME_ID
    ? `${name} - Cover Letter.pdf`
    : `${name} - ${id} Cover Letter.pdf`;
}

export function assetHref(filename: string) {
  return `/assets/${encodeURIComponent(filename)}`;
}

export function resumePdfHref(id: string, name: string) {
  return assetHref(resumePdfFilename(id, name));
}

export function coverLetterPdfHref(id: string, name: string) {
  return assetHref(coverLetterPdfFilename(id, name));
}

export function isBuiltinResume(id: string) {
  return builtinResumeDocuments.some((resume) => resume.id === id);
}

export function resumeDisplayName(doc: ResumeDocument) {
  if (doc.id === "ai-dev") return "AI";
  if (doc.id === "game-dev") return "Game Dev";
  if (doc.id === DEFAULT_RESUME_ID) return "Software";
  return doc.tagline ?? doc.id;
}
