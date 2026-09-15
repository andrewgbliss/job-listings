import type { ResumeDocument } from "../types";
import { jobSearchResume } from "./google.com/job_search_resume";
import { job4434809153Resume } from "./linkedin.com/job_4434809153_resume";
import { job4461381505Resume } from "./linkedin.com/job_4461381505_resume";
import { job4466103929Resume } from "./linkedin.com/job_4466103929_resume";

export const scrapedResumes: Array<ResumeDocument> = [
  jobSearchResume,
  job4434809153Resume,
  job4461381505Resume,
  job4466103929Resume,
];
