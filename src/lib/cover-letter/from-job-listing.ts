import fs from "node:fs";
import path from "node:path";
import {
  createResumeFromJobListing,
  type CreateResumeFromJobOptions,
  type JobListing,
} from "../job-listings/utils/from-job-listing";

const MAIN_COVER_LETTER_PATH = path.join(
  "src",
  "lib",
  "cover-letter",
  "main_cover_letter.md",
);

export type CoverLetterDocument = {
  id: string;
  body: string;
  position: string;
  company?: string;
  sourceUrl?: string;
  searchUrl?: string;
  processedAt?: string;
};

export type TailorCoverLetterInput = {
  position: string;
  company?: string;
  skills?: Array<string>;
  mentionsNext?: boolean;
};

export type CreateCoverLetterOptions = CreateResumeFromJobOptions & {
  template?: string;
};

export function coverLetterFileName(id: string) {
  return `${id.replace(/-/g, "_")}_cover_letter.md`;
}

export function coverLetterHref(id: string) {
  return `/resume/${id}/cover-letter` as const;
}

export function loadMainCoverLetterTemplate(cwd = process.cwd()) {
  return fs.readFileSync(path.join(cwd, MAIN_COVER_LETTER_PATH), "utf8");
}

function listingMentionsNext(job: JobListing) {
  return /\bnext(?:\.js|js)?\b/i.test(
    [job.title, job.skills.join(" ")].filter(Boolean).join(" "),
  );
}

function skillList(skills: Array<string>) {
  if (skills.length >= 3) {
    return `${skills[0]}, ${skills[1]}, ${skills[2]}`;
  }
  if (skills.length === 2) {
    return `${skills[0]}, ${skills[1]}`;
  }
  if (skills.length === 1) {
    return skills[0];
  }
  return "JavaScript, PHP, Python";
}

function withIndefiniteArticle(position: string) {
  return /^[aeiou]/i.test(position) ? `an ${position}` : `a ${position}`;
}

/** Fill `{{POSITION}}` and remap skills in the main cover letter for a listing. */
export function tailorCoverLetter(
  template: string,
  input: TailorCoverLetterInput,
) {
  const position = input.position.trim() || "Web Developer";
  const roleClause = input.company
    ? `${position} position at ${input.company}`
    : `${position} position`;
  let body = template.replace(/\{\{POSITION\}\}\s*position/gi, roleClause);
  body = body.replace(
    /I am a \{\{POSITION\}\}/g,
    `I am ${withIndefiniteArticle(position)}`,
  );
  body = body.replace(/\{\{POSITION\}\}/g, position);
  body = body.replace(
    /the Web Developer position(?! at )/g,
    `the ${roleClause}`,
  );
  body = body.replace(
    /I am a web developer with/g,
    `I am ${withIndefiniteArticle(position)} with`,
  );

  const listed = skillList(input.skills ?? []);
  body = body.replaceAll("JavaScript, PHP, Python", listed);
  body = body.replaceAll("JavaScript, React", listed);

  if (!input.mentionsNext) {
    const skill = input.skills?.[0];
    const replacement = skill
      ? `By leveraging ${skill} and careful performance work, I ensure fast load times and seamless user interactions.`
      : "I ensure fast load times and seamless user interactions through careful performance work in production applications.";
    body = body.replace(
      /By leveraging features like server-side rendering \(SSR\) and static site generation \(SSG\), I ensure fast load times and seamless user interactions\./,
      replacement,
    );
  }

  return `${body.replace(/\s+$/, "")}\n`;
}

export function createCoverLetterFromJobListing(
  job: JobListing,
  options: CreateCoverLetterOptions = {},
): CoverLetterDocument {
  const { template, ...resumeOptions } = options;
  const resume = createResumeFromJobListing(job, resumeOptions);
  const body = tailorCoverLetter(template ?? loadMainCoverLetterTemplate(), {
    position: resume.tagline,
    company: job.company,
    skills: resume.skills ?? [],
    mentionsNext: listingMentionsNext(job),
  });

  return {
    id: resume.id,
    body,
    position: resume.tagline,
    company: job.company,
    sourceUrl: resume.sourceUrl,
    searchUrl: resume.searchUrl,
    processedAt: resume.processedAt,
  };
}
