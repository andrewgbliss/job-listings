import {
  findKeywordPhrases,
  findKeywordSkills,
  skillHitsKeyword,
  sortSkillsByWeight,
  webDeveloperKeywords,
} from "./keywords";
import { aiDevResume } from "../../resume/ai_dev_resume";
import { gameDevResume } from "../../resume/game_dev_resume";
import { mainResume } from "../../resume/main_resume";
import { processedAtIso } from "./scraped-path";
import type { ResumeDocument, WorkExperience } from "./types";

export type JobListing = {
  url: string;
  title?: string;
  description?: string;
  /** Hiring company. Stored on listing JSON and tables, not on the resume. */
  company?: string;
  skills: Array<string>;
  searchUrl?: string;
};

export type TailoredResume = {
  id: string;
  tags: Array<string>;
  tagline: string;
  backgroundParagraphs: Array<string>;
  workExperience: Array<WorkExperience>;
  sourceUrl: string;
  searchUrl?: string;
  jobTitle?: string;
  processedAt?: string;
  skills?: Array<string>;
};

export type CreateResumeFromJobOptions = {
  id?: string;
  maxJobs?: number;
  searchUrl?: string;
  processedAt?: string;
};

function toDate(value: Date) {
  return value instanceof Date ? value : new Date(value);
}

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "job";
}

export function resumeIdFromJob(job: JobListing, fallback = "job") {
  try {
    const href = new URL(job.url);
    const view = href.pathname.match(/\/jobs\/view\/(\d+)/);
    if (view?.[1]) {
      return `job-${view[1]}`;
    }
    const last = href.pathname.split("/").filter(Boolean).at(-1);
    if (last) {
      return `job-${slugify(last)}`;
    }
  } catch {
    // Fall through.
  }
  return `job-${slugify(fallback)}`;
}

export function resumeFileName(id: string) {
  return `${id.replace(/-/g, "_")}_resume.ts`;
}

export function resumeExportName(id: string) {
  const camel = id.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
  const safe = camel.replace(/[^a-zA-Z0-9]/g, "");
  return `${safe}Resume`;
}

function jobSearchText(job: JobListing) {
  return normalize(
    [job.title, job.description, job.skills.join(" ")].filter(Boolean).join(" "),
  );
}

function skillHitsJob(skill: string, haystack: string) {
  return skillHitsKeyword(skill, haystack, webDeveloperKeywords);
}

type ListingLanguage = {
  skills: Array<string>;
  phrases: Array<string>;
};

function ownedResumeSkills() {
  return [
    ...new Set(
      [mainResume, aiDevResume, gameDevResume].flatMap((resume) =>
        resume.workExperience.flatMap((work) => work.skills),
      ),
    ),
  ];
}

function extractListingLanguage(job: JobListing): ListingLanguage {
  const haystack = jobSearchText(job);
  const skills: Array<string> = [];
  const add = (skill: string) => {
    const name = skill.trim();
    if (!name || skills.some((item) => skillsMatch(item, name))) {
      return;
    }
    skills.push(name);
  };
  for (const skill of job.skills) {
    add(skill);
  }
  for (const skill of findKeywordSkills(haystack, webDeveloperKeywords)) {
    add(skill);
  }
  for (const skill of ownedResumeSkills()) {
    if (skillHitsJob(skill, haystack)) {
      add(skill);
    }
  }
  const phrases = findKeywordPhrases(haystack, webDeveloperKeywords);
  return { skills, phrases };
}

function skillsMatch(a: string, b: string) {
  return skillHitsJob(a, normalize(b)) || skillHitsJob(b, normalize(a));
}

function listingSkillName(skill: string, language: ListingLanguage) {
  const match = language.skills.find((listingSkill) => skillsMatch(skill, listingSkill));
  return match ?? skill;
}

const MAX_WORK_SKILLS = 5;

function tailorSkills(skills: Array<string>, language: ListingLanguage) {
  const owned = [...new Set(skills)];
  const remapped = owned.map((skill) => listingSkillName(skill, language));
  const matched: Array<string> = [];
  for (const listingSkill of language.skills) {
    const original = remapped.find((skill) => skillsMatch(skill, listingSkill));
    if (!original || matched.some((item) => skillsMatch(item, original))) {
      continue;
    }
    matched.push(original);
    if (matched.length >= MAX_WORK_SKILLS) {
      break;
    }
  }
  const rest = remapped.filter(
    (skill) => !matched.some((item) => skillsMatch(item, skill)),
  );
  const extras = rest.slice(0, Math.max(0, MAX_WORK_SKILLS - matched.length));
  return {
    skills: [...matched, ...extras],
    matched,
  };
}

function mostImportantListingSkill(language: ListingLanguage) {
  return sortSkillsByWeight(language.skills)[0];
}

function tailorBullet(point: string, language: ListingLanguage) {
  if (language.skills.some((skill) => skillsMatch(skill, "Next.js"))) {
    return point;
  }
  const skill = mostImportantListingSkill(language);
  if (!skill || !/\bNext(?:\.js|JS|js)?\b/.test(point)) {
    return point;
  }
  return point
    .replace(/\bNext\.js\b/g, skill)
    .replace(/\bNextJS\b/g, skill)
    .replace(/\bNextjs\b/g, skill);
}

function tailorWork(work: WorkExperience, language: ListingLanguage): WorkExperience {
  const { skills, matched } = tailorSkills(work.skills, language);

  return {
    company: work.company,
    location: { ...work.location },
    from: toDate(work.from),
    to: toDate(work.to),
    skills,
    matchedSkills: matched,
    bulletpoints: work.bulletpoints.map((point) => tailorBullet(point, language)),
    ...(work.url ? { url: work.url } : {}),
  };
}

function overlapSkills(workExperience: Array<WorkExperience>, language: ListingLanguage) {
  const fromWork = [...new Set(workExperience.flatMap((work) => work.skills))];
  return language.skills.filter((skill) =>
    fromWork.some((item) => skillsMatch(item, skill)),
  );
}

function pickResumeSkills(
  workExperience: Array<WorkExperience>,
  language: ListingLanguage,
) {
  const matched = overlapSkills(workExperience, language);
  if (matched.length >= 5) {
    return sortSkillsByWeight(matched);
  }
  const seen = new Set(matched.map((skill) => normalize(skill)));
  const extras: Array<string> = [];
  for (const skill of sortSkillsByWeight(
    workExperience.flatMap((work) => work.skills),
  )) {
    const key = normalize(skill);
    if (seen.has(key) || matched.some((item) => skillsMatch(item, skill))) {
      continue;
    }
    seen.add(key);
    extras.push(skill);
    if (extras.length >= 5 - matched.length) {
      break;
    }
  }
  return sortSkillsByWeight([...matched, ...extras]);
}

function tagsFromJob(job: JobListing, id: string, language: ListingLanguage) {
  const tags: Array<string> = [];
  const title = job.title ?? "";
  if (/\b(generative ai|machine learning|\bllm|artificial intelligence)\b/i.test(title)) {
    tags.push("AI");
  } else if (language.phrases.includes("full-stack") || /\bfull[-\s]?stack\b/i.test(title)) {
    tags.push("Full-Stack");
  } else if (/\bfront[-\s]?end\b/i.test(title)) {
    tags.push("Front-End");
  } else if (/\bback[-\s]?end\b/i.test(title)) {
    tags.push("Back-End");
  } else if (/\bgame\b/i.test(title)) {
    tags.push("Game Developer");
  } else if (language.skills[0]) {
    tags.push(language.skills[0]);
  }
  if (tags.length === 0) {
    tags.push(id);
  }
  return [...new Set(tags)].slice(0, 3);
}

const ROLE_TAIL =
  /\b(engineer|developer|architect|programmer|designer|manager|lead|staff|principal|director|consultant|analyst|specialist)\b/i;

function isChromeTitle(title: string) {
  return /premium|notification|linkedin|sign in|click apply|try premium|skip to main|early applicant|clicked apply|be an early|401|benefit|posted \d|job alerts/i.test(
    title,
  );
}

function stripListingTitleChrome(title: string) {
  return title
    .replace(/\s*\|\s*LinkedIn\s*$/i, "")
    .split("|")[0]
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(
      /\s+in\s+[A-Za-z .'-]+,\s*[A-Z]{2}(?:\s*,\s*United States)?$/i,
      "",
    )
    .replace(
      /\s+[A-Z][a-z.]+(?:[ -][A-Z][a-z.]+)*,\s*[A-Z]{2}(?:\s*,\s*United States)?$/,
      "",
    )
    .replace(
      /\s+(?:Greater\s+)?[A-Z][a-z.]+(?:[ -][A-Z][a-z.]+)*(?:\s+Metropolitan)?\s+Area$/i,
      "",
    )
    .replace(/\s*&.*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function roleTitleFromListing(title: string) {
  const parts = title
    .split(/\s+[-–—]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const tail = parts.slice(-2).join(" - ");
    if (ROLE_TAIL.test(tail) && tail.length <= 80 && !isChromeTitle(tail)) {
      return tail;
    }
    const last = parts.at(-1) ?? "";
    if (ROLE_TAIL.test(last) && last.length >= 8 && last.length <= 80) {
      return last;
    }
  }
  return title;
}

function roleFromPrefixedTitle(title: string) {
  const match = title.match(
    /((?:Senior |Staff |Principal |Lead |Junior |Jr\.? |Technical )?(?:Full[ -]?Stack |Frontend |Front[ -]End |Backend |Back[ -]End |Web |Mobile |Platform |Cloud |Data |Digital |Application )?(?:Software )?(?:Engineer|Developer|Architect|Consultant|Manager|Designer|Analyst|Specialist)(?:\s+(?:I{1,3}|IV|V|[2-5]))?)$/i,
  );
  const role = match?.[1]?.trim();
  if (!role || role.length < 8 || role.length > 80) {
    return title;
  }
  const company = title.slice(0, Math.max(0, title.length - role.length)).trim();
  if (
    company.length < 2 ||
    /^(web|mobile|software|platform|cloud|data|digital|application|product|senior|staff|lead|principal|junior|technical)$/i.test(
      company,
    )
  ) {
    return title;
  }
  return role;
}

function taglineFromJob(job: JobListing) {
  const title = stripListingTitleChrome(job.title ?? "");
  if (!title || isChromeTitle(title) || title.length > 80) {
    return mainResume.tagline;
  }
  const role = roleFromPrefixedTitle(roleTitleFromListing(title))
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!role || role.length < 8 || role.length > 80 || isChromeTitle(role)) {
    return mainResume.tagline;
  }
  return role;
}

function tailorSummary(tagline: string) {
  return mainResume.backgroundParagraphs.map((paragraph, index) => {
    if (index !== 0 || tagline === mainResume.tagline) {
      return paragraph;
    }
    if (!/^(.+?) with /.test(paragraph)) {
      return paragraph;
    }
    return paragraph.replace(/^(.+?) with /, `${tagline} with `);
  });
}

function listingLooksAi(text: string) {
  return /\b(generative ai|machine learning|\bllms?\b|artificial intelligence|ai-native|ai-assisted|copilot|chatgpt)\b/i.test(
    text,
  );
}

function listingLooksGame(text: string) {
  return /\b(game developer|gameplay|godot|unity|gamedev|video game)\b/i.test(text);
}

function extraResumesForJob(job: JobListing) {
  const text = jobSearchText(job);
  const extras: Array<ResumeDocument> = [];
  if (listingLooksAi(text)) {
    extras.push(aiDevResume);
  }
  if (listingLooksGame(text)) {
    extras.push(gameDevResume);
  }
  return extras;
}

export function createResumeFromJobListing(
  job: JobListing,
  options: CreateResumeFromJobOptions = {},
): TailoredResume {
  const language = extractListingLanguage(job);
  const id = options.id || resumeIdFromJob(job);
  const byCompany = new Map<string, WorkExperience>();

  // Keep the main timeline, bullet order, and wording. Specialty resumes may
  // add companies that are not already on main — they never replace a job.
  for (const work of mainResume.workExperience) {
    byCompany.set(work.company.toLowerCase(), work);
  }
  for (const resume of extraResumesForJob(job)) {
    for (const work of resume.workExperience) {
      const key = work.company.toLowerCase();
      if (!byCompany.has(key)) {
        byCompany.set(key, work);
      }
    }
  }

  const jobs = [...byCompany.values()].sort(
    (a, b) => toDate(b.from).getTime() - toDate(a.from).getTime(),
  );
  const limited =
    options.maxJobs && options.maxJobs > 0
      ? jobs.slice(0, options.maxJobs)
      : jobs;

  const workExperience = limited.map((work) => tailorWork(work, language));

  const tagline = taglineFromJob(job);

  return {
    id,
    tags: tagsFromJob(job, id, language),
    tagline,
    backgroundParagraphs: tailorSummary(tagline),
    workExperience,
    skills: pickResumeSkills(workExperience, language),
    sourceUrl: job.url,
    searchUrl: options.searchUrl || job.searchUrl,
    jobTitle: job.title,
    processedAt: options.processedAt || processedAtIso(),
  };
}

function serializeDate(date: Date, allowPresent = false) {
  const value = toDate(date);
  if (allowPresent) {
    const now = new Date();
    const days = (now.getTime() - value.getTime()) / 86_400_000;
    if (days >= -2 && days < 60) {
      return "new Date()";
    }
  }
  return `new Date(${value.getFullYear()}, ${value.getMonth()}, ${value.getDate()})`;
}

function serializeWork(work: WorkExperience) {
  const urlLine = work.url ? `\n      url: ${JSON.stringify(work.url)},` : "";
  const skills = work.skills.map((skill) => `        ${JSON.stringify(skill)},`).join("\n");
  const matchedLine =
    work.matchedSkills && work.matchedSkills.length > 0
      ? `\n      matchedSkills: ${JSON.stringify(work.matchedSkills)},`
      : "";
  const bullets = work.bulletpoints
    .map((point) => `        ${JSON.stringify(point)},`)
    .join("\n");

  return `    {
      company: ${JSON.stringify(work.company)},${urlLine}
      location: {
        city: ${JSON.stringify(work.location.city)},
        state: ${JSON.stringify(work.location.state)},
        postalCode: ${JSON.stringify(work.location.postalCode)},
        country: ${JSON.stringify(work.location.country)},
      },
      from: ${serializeDate(work.from)},
      to: ${serializeDate(work.to, true)},
      skills: [
${skills}
      ],${matchedLine}
      bulletpoints: [
${bullets}
      ],
    }`;
}

export function renderTailoredResumeModule(
  resume: TailoredResume,
  options: { importFrom?: string; typesImportFrom?: string } = {},
) {
  const exportName = resumeExportName(resume.id);
  const from = options.importFrom ?? ".";
  const typesFrom = options.typesImportFrom ?? from;
  const taglineLine =
    resume.tagline !== mainResume.tagline
      ? `\n  tagline: ${JSON.stringify(resume.tagline)},`
      : "";
  const backgroundLine =
    JSON.stringify(resume.backgroundParagraphs) !==
    JSON.stringify(mainResume.backgroundParagraphs)
      ? `\n  backgroundParagraphs: [\n${resume.backgroundParagraphs
          .map((paragraph) => `    ${JSON.stringify(paragraph)},`)
          .join("\n")}\n  ],`
      : "";
  const jobs = resume.workExperience.map(serializeWork).join(",\n");
  const source = resume.jobTitle ?? resume.sourceUrl;

  const searchLine =
    resume.searchUrl && resume.searchUrl !== resume.sourceUrl
      ? `\n  searchUrl: ${JSON.stringify(resume.searchUrl)},`
      : "";
  const processedLine = resume.processedAt
    ? `\n  processedAt: ${JSON.stringify(resume.processedAt)},`
    : "";
  const skillsLine =
    resume.skills && resume.skills.length > 0
      ? `\n  skills: ${JSON.stringify(resume.skills)},`
      : resume.skills
        ? `\n  skills: [],`
        : "";

  return `import { mainResume } from "${from}/main_resume";
import type { ResumeDocument } from "${typesFrom}/types";

/** Tailored from ${source} — ${resume.sourceUrl} */
export const ${exportName}: ResumeDocument = {
  ...mainResume,
  id: ${JSON.stringify(resume.id)},
  tags: ${JSON.stringify(resume.tags)},${taglineLine}${backgroundLine}
  sourceUrl: ${JSON.stringify(resume.sourceUrl)},${searchLine}${processedLine}${skillsLine}
  workExperience: [
${jobs}
  ],
};
`;
}
