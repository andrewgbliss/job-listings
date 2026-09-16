import { aiDevResume } from "../../resume/ai_dev_resume";
import { gameDevResume } from "../../resume/game_dev_resume";
import { loadScrapedResumes } from "./load-scraped";
import { mainResume } from "../../resume/main_resume";
import type { ResumeDocument } from "./types";

const builtinResumeDocuments: Array<ResumeDocument> = [
  mainResume,
  aiDevResume,
  gameDevResume,
];

export async function getScrapedResumeDocuments() {
  return loadScrapedResumes();
}

export async function getResumeDocuments(): Promise<Array<ResumeDocument>> {
  return [...builtinResumeDocuments, ...(await loadScrapedResumes())];
}

export async function getResumeById(
  id: string,
): Promise<ResumeDocument | undefined> {
  const builtin = builtinResumeDocuments.find((resume) => resume.id === id);
  if (builtin) {
    return builtin;
  }
  return (await loadScrapedResumes()).find((resume) => resume.id === id);
}

export async function getAllResumeIds(): Promise<Array<string>> {
  return (await getResumeDocuments()).map((resume) => resume.id);
}
