import { aiDevResume } from "./ai_dev_resume";
import { gameDevResume } from "./game_dev_resume";
import { mainResume } from "./main_resume";
import { scrapedResumes } from "./scraped";
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

export const scrapedResumeDocuments: Array<ResumeDocument> = scrapedResumes;

export const resumeDocuments: Array<ResumeDocument> = [
  ...builtinResumeDocuments,
  ...scrapedResumeDocuments,
];

/** Default resume id and canonical `/resume` redirect target. */
export const DEFAULT_RESUME_ID = mainResume.id;

export const defaultResumeHref = `/resume/${DEFAULT_RESUME_ID}` as const;

/** Backward-compatible export: primary (software) resume content + metadata. */
export const resume: ResumeDocument = mainResume;

export function getResumeById(id: string): ResumeDocument | undefined {
  return resumeDocuments.find((r) => r.id === id);
}

export const allResumesHref = "/resume/all" as const;

export {
  defaultScrapedFolderPath,
  scrapedFolderHref,
} from "./scraped-path";

export function getAllResumeIds(): Array<string> {
  return resumeDocuments.map((r) => r.id).filter((item) => item !== null);
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
