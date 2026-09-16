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

export type PdfNameSource = {
  name: string;
  company?: string;
  jobTitle?: string;
  tagline?: string;
  title?: string;
};

function sanitizePdfPart(value: string) {
  return value
    .replace(/[·•]/g, "-")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pdfStem(doc: PdfNameSource) {
  const jobTitle = doc.jobTitle || doc.title || doc.tagline;
  return [doc.name, doc.company, jobTitle]
    .map((part) => (part ? sanitizePdfPart(part) : ""))
    .filter(Boolean)
    .join(" - ");
}

export function resumePdfFilename(doc: PdfNameSource) {
  const stem = pdfStem(doc);
  return `${stem || "Resume"} - Resume.pdf`;
}

export function coverLetterPdfFilename(doc: PdfNameSource) {
  const stem = pdfStem(doc);
  return `${stem || "Cover Letter"} - Cover Letter.pdf`;
}

export function assetHref(filename: string) {
  return `/assets/${encodeURIComponent(filename)}`;
}

export function resumePdfHref(doc: PdfNameSource) {
  return assetHref(resumePdfFilename(doc));
}

export function coverLetterPdfHref(doc: PdfNameSource) {
  return assetHref(coverLetterPdfFilename(doc));
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
