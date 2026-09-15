import { aiDevResume } from "./ai_dev_resume";
import { gameDevResume } from "./game_dev_resume";
import { mainResume } from "./main_resume";
import type { ResumeDocument, WorkExperience } from "./types";

const sourceResumes: Array<ResumeDocument> = [
  mainResume,
  aiDevResume,
  gameDevResume,
];

export type JobListing = {
  url: string;
  title?: string;
  description?: string;
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
};

export type CreateResumeFromJobOptions = {
  id?: string;
  maxJobs?: number;
  searchUrl?: string;
};

const SKILL_ALIASES: Record<string, Array<string>> = {
  typescript: ["ts", "typescript"],
  javascript: ["js", "javascript"],
  "next.js": ["nextjs", "next.js", "next"],
  react: ["reactjs", "react.js", "react"],
  postgresql: ["postgres", "postgresql", "psql"],
  kubernetes: ["k8s", "kubernetes"],
  "node.js": ["nodejs", "node.js", "node"],
  "ci/cd": ["cicd", "ci/cd"],
  "tailwind css": ["tailwind", "tailwindcss", "tailwind css"],
  docker: ["docker"],
  gcp: ["gcp", "google cloud"],
  aws: ["aws", "amazon web services"],
  python: ["python"],
  godot: ["godot", "gdscript"],
  unity: ["unity"],
  php: ["php"],
  angular: ["angular"],
  redis: ["redis"],
  graphql: ["graphql"],
  "ai-assisted development": ["llm", "ai-assisted", "generative ai", "chatgpt", "copilot"],
};

const ROLE_WORDS =
  /\b(engineer|developer|architect|programmer|designer|manager|lead|staff|principal|director)\b/i;

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
  const key = normalize(skill);
  if (key.length > 1 && haystack.includes(key)) {
    return true;
  }
  const aliases = SKILL_ALIASES[key] ?? [key];
  return aliases.some((alias) => haystack.includes(alias));
}

function scoreWork(work: WorkExperience, haystack: string) {
  let score = 0;
  for (const skill of work.skills) {
    if (skillHitsJob(skill, haystack)) {
      score += 3;
    }
  }
  for (const point of work.bulletpoints) {
    for (const word of normalize(point).split(" ")) {
      if (word.length > 4 && haystack.includes(word)) {
        score += 0.25;
      }
    }
  }
  return score;
}

type ListingLanguage = {
  haystack: string;
  skills: Array<string>;
  phrases: Array<string>;
  values: Array<string>;
};

const SKILL_CATALOG: Array<{ name: string; pattern: RegExp }> = [
  { name: "Node.js", pattern: /\bnode(?:\.?js)?\b/i },
  { name: "React", pattern: /\breact(?:\.js|js)?\b/i },
  { name: "Next.js", pattern: /\bnext(?:\.js|js)?\b/i },
  { name: "TypeScript", pattern: /\btypescript\b/i },
  { name: "JavaScript", pattern: /\bjavascript\b/i },
  { name: "PostgreSQL", pattern: /\bpostgres(?:ql)?\b/i },
  { name: "Docker", pattern: /\bdocker\b/i },
  { name: "Kubernetes", pattern: /\bkubernetes\b|\bk8s\b/i },
  { name: "GraphQL", pattern: /\bgraphql\b/i },
  { name: "Express", pattern: /\bexpress(?:\.?js)?\b/i },
  { name: "Redis", pattern: /\bredis\b/i },
  { name: "AWS", pattern: /\baws\b|amazon web services/i },
  { name: "GCP", pattern: /\bgcp\b|google cloud/i },
  { name: "CI/CD", pattern: /\bci\/cd\b|\bcicd\b/i },
  { name: "Python", pattern: /\bpython\b/i },
  { name: "PHP", pattern: /\bphp\b/i },
  { name: "Angular", pattern: /\bangular\b/i },
  { name: "Tailwind", pattern: /\btailwind\b/i },
  { name: "BigQuery", pattern: /\bbigquery\b/i },
  { name: "MySQL", pattern: /\bmysql\b/i },
];

const LISTING_PHRASES: Array<{ phrase: string; pattern: RegExp }> = [
  { phrase: "full-stack", pattern: /\bfull[-\s]?stack\b/i },
  { phrase: "REST APIs", pattern: /\brest(?:ful)?(?:\s+apis?)?\b/i },
  { phrase: "web application", pattern: /\bweb apps?\b|\bweb applications?\b/i },
  { phrase: "front-end", pattern: /\bfront[-\s]?end\b/i },
  { phrase: "back-end", pattern: /\bback[-\s]?end\b/i },
  { phrase: "microservices", pattern: /\bmicroservices?\b/i },
  { phrase: "production", pattern: /\bproduction\b/i },
  { phrase: "CI/CD", pattern: /\bci\/cd\b/i },
];

const VALUE_TERMS = [
  "performance",
  "reliability",
  "scalability",
  "security",
  "maintainability",
  "quality",
] as const;

function workCorpus(work: WorkExperience) {
  return normalize([...work.skills, ...work.bulletpoints].join(" "));
}

function workSupports(work: WorkExperience, skill: string) {
  return skillHitsJob(skill, workCorpus(work));
}

function extractListingLanguage(job: JobListing): ListingLanguage {
  const haystack = jobSearchText(job);
  const skillHits = SKILL_CATALOG.filter((skill) => skill.pattern.test(haystack))
    .sort((a, b) => haystack.search(a.pattern) - haystack.search(b.pattern))
    .map((skill) => skill.name);
  const fromJobSkills = job.skills.filter(Boolean);
  const skills = [...new Set([...fromJobSkills, ...skillHits])];
  const phrases = LISTING_PHRASES.filter((item) => item.pattern.test(haystack)).map(
    (item) => item.phrase,
  );
  const values = VALUE_TERMS.filter((term) => haystack.includes(term));
  return { haystack, skills, phrases, values };
}

function listingSkillName(skill: string, language: ListingLanguage) {
  const match = language.skills.find(
    (listingSkill) =>
      skillHitsJob(skill, normalize(listingSkill)) ||
      skillHitsJob(listingSkill, normalize(skill)),
  );
  return match ?? skill;
}

function tailorSkills(skills: Array<string>, language: ListingLanguage) {
  const renamed = skills.map((skill) => listingSkillName(skill, language));
  const extras = language.skills.filter((skill) =>
    renamed.some((item) => skillHitsJob(item, normalize(skill)) || skillHitsJob(skill, normalize(item))),
  );
  const combined = [...new Set([...extras, ...renamed])];
  const matched = combined.filter((skill) => skillHitsJob(skill, language.haystack));
  const rest = combined.filter((skill) => !skillHitsJob(skill, language.haystack));
  return [...matched, ...rest];
}

function applyListingLanguage(text: string, language: ListingLanguage, work: WorkExperience) {
  let out = text;
  const wantsNode = language.skills.some((skill) => /^node/i.test(skill));
  const wantsReact = language.skills.some((skill) => /^react$/i.test(skill));
  const canNode =
    workSupports(work, "node.js") ||
    workSupports(work, "next.js") ||
    workSupports(work, "express");
  const canReact = workSupports(work, "react") || workSupports(work, "next.js");

  if (wantsNode && canNode) {
    out = out.replace(/\bNode(?!\.js)\b/g, "Node.js");
  }
  if (wantsNode && wantsReact && canNode && canReact) {
    out = out.replace(/\bReact\/Next\.js\b/g, "Node.js/React (Next.js)");
    out = out.replace(/\bPHP → React\/Next\.js\b/g, "PHP → Node.js/React (Next.js)");
  }
  if (
    language.phrases.includes("REST APIs") &&
    /\bAPI/i.test(out) &&
    !/\bREST\b/i.test(out)
  ) {
    out = out.replace(/\bAPIs\b/, "REST APIs");
    out = out.replace(/\bAPI\b/, "REST API");
  }
  if (language.phrases.includes("web application")) {
    out = out.replace(/\bplatform\b/i, "web application");
    out = out.replace(/\bsystem\b/i, "web application");
  }
  if (language.phrases.includes("full-stack") && canNode && canReact && !/full[-\s]?stack/i.test(out)) {
    if (/\bNode\.js\/React/.test(out)) {
      out = out.replace(/\bNode\.js\/React/, "full-stack Node.js/React");
    } else if (/\bReact\b/.test(out)) {
      out = out.replace(/\bReact\b/, "full-stack React");
    }
  }
  if (
    language.skills.includes("TypeScript") &&
    workSupports(work, "typescript") &&
    /\bReact\b/.test(out) &&
    !/TypeScript/i.test(out)
  ) {
    out = out.replace(/\bReact\b/, "React/TypeScript");
  }
  return out.replace(/\s+/g, " ").trim();
}

function scoreBullet(bullet: string, language: ListingLanguage) {
  const text = normalize(bullet);
  let score = 0;
  for (const skill of language.skills) {
    if (skillHitsJob(skill, text)) {
      score += 3;
    }
  }
  for (const phrase of language.phrases) {
    if (text.includes(normalize(phrase))) {
      score += 2;
    }
  }
  return score;
}

function tailorWork(work: WorkExperience, language: ListingLanguage): WorkExperience {
  const bulletpoints = work.bulletpoints
    .map((point) => applyListingLanguage(point, language, work))
    .sort((a, b) => scoreBullet(b, language) - scoreBullet(a, language));

  return {
    company: work.company,
    location: { ...work.location },
    from: toDate(work.from),
    to: toDate(work.to),
    skills: tailorSkills(work.skills, language).filter(
      (skill) =>
        work.skills.some((original) => skillHitsJob(original, normalize(skill))) ||
        workSupports(work, skill),
    ),
    bulletpoints,
    ...(work.url ? { url: work.url } : {}),
  };
}

function joinList(items: Array<string>) {
  if (items.length === 0) {
    return "";
  }
  if (items.length === 1) {
    return items[0];
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function overlapSkills(workExperience: Array<WorkExperience>, language: ListingLanguage) {
  const fromWork = [...new Set(workExperience.flatMap((work) => work.skills))];
  const matched = language.skills.filter((skill) =>
    fromWork.some(
      (item) =>
        skillHitsJob(item, normalize(skill)) || skillHitsJob(skill, normalize(item)),
    ),
  );
  return matched.length > 0 ? matched.slice(0, 7) : fromWork.slice(0, 7);
}

function listingStackPhrase(
  job: JobListing,
  workExperience: Array<WorkExperience>,
  language: ListingLanguage,
) {
  const titleStack = job.title?.match(/\(([^)]+)\)/)?.[1]?.trim();
  if (titleStack && /node|react|python|java|typescript|javascript/i.test(titleStack)) {
    return titleStack;
  }
  return joinList(overlapSkills(workExperience, language));
}

function tailorSummary(
  job: JobListing,
  language: ListingLanguage,
  workExperience: Array<WorkExperience>,
) {
  const title = taglineFromJob(job);
  const location = `${mainResume.address.city}, ${mainResume.address.state}`;
  const stack = listingStackPhrase(job, workExperience, language);
  const overlap = overlapSkills(workExperience, language);
  const values =
    language.values.length > 0
      ? joinList(language.values.slice(0, 3))
      : "performance, reliability, and shipping";
  const degree = /bachelor|computer science|degree/i.test(language.haystack)
    ? ` B.S. Computer Science, ${mainResume.education.school}.`
    : "";
  const companies = workExperience.slice(0, 2).map((work) => work.company);
  const metrics = workExperience
    .flatMap((work) => work.bulletpoints)
    .map((point) =>
      point.match(/((?:cut|raised|grew|reduced|improved)[^.]{0,60}\d+%)/i)?.[1]?.trim(),
    )
    .filter((item): item is string => Boolean(item))
    .slice(0, 2);
  const paragraph1 = `${title} in ${location}.${degree} Builds production software in ${stack}, with a bias toward ${values}.`;
  const paragraph2 = companies.length
    ? `At ${joinList(companies)}, shipped ${stack} web applications, APIs, and data pipelines${
        metrics.length ? ` — ${metrics.join("; ")}` : ""
      }.`
    : (mainResume.backgroundParagraphs?.[1] ?? "");

  return [paragraph1, paragraph2].filter(Boolean);
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

function taglineFromJob(job: JobListing) {
  const title = job.title?.trim();
  if (title && ROLE_WORDS.test(title) && title.length < 80) {
    return title;
  }
  return mainResume.tagline;
}

export function createResumeFromJobListing(
  job: JobListing,
  options: CreateResumeFromJobOptions = {},
): TailoredResume {
  const haystack = jobSearchText(job);
  const language = extractListingLanguage(job);
  const maxJobs = options.maxJobs ?? 4;
  const id = options.id || resumeIdFromJob(job);
  const bestByCompany = new Map<
    string,
    { work: WorkExperience; score: number }
  >();

  for (const resume of sourceResumes) {
    for (const work of resume.workExperience) {
      const score = scoreWork(work, haystack);
      const key = work.company.toLowerCase();
      const prev = bestByCompany.get(key);
      if (!prev || score > prev.score) {
        bestByCompany.set(key, { work, score });
      }
    }
  }

  const ranked = [...bestByCompany.values()].sort((a, b) => b.score - a.score);
  const selected = ranked
    .filter((entry) => entry.score > 0)
    .slice(0, maxJobs);

  const jobs =
    selected.length > 0
      ? selected
      : ranked.slice(0, Math.min(maxJobs, ranked.length));

  const workExperience = jobs
    .map((entry) => tailorWork(entry.work, language))
    .sort((a, b) => toDate(b.from).getTime() - toDate(a.from).getTime());

  return {
    id,
    tags: tagsFromJob(job, id, language),
    tagline: taglineFromJob(job),
    backgroundParagraphs: tailorSummary(job, language, workExperience),
    workExperience,
    sourceUrl: job.url,
    searchUrl: options.searchUrl || job.searchUrl,
    jobTitle: job.title,
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
      ],
      bulletpoints: [
${bullets}
      ],
    }`;
}

export function renderTailoredResumeModule(
  resume: TailoredResume,
  options: { importFrom?: string } = {},
) {
  const exportName = resumeExportName(resume.id);
  const from = options.importFrom ?? ".";
  const taglineLine =
    resume.tagline !== mainResume.tagline
      ? `\n  tagline: ${JSON.stringify(resume.tagline)},`
      : "";
  const background = resume.backgroundParagraphs.map(
    (paragraph) => `    ${JSON.stringify(paragraph)},`,
  ).join("\n");
  const jobs = resume.workExperience.map(serializeWork).join(",\n");
  const source = resume.jobTitle ?? resume.sourceUrl;

  const searchLine =
    resume.searchUrl && resume.searchUrl !== resume.sourceUrl
      ? `\n  searchUrl: ${JSON.stringify(resume.searchUrl)},`
      : "";

  return `import { mainResume } from "${from}/main_resume";
import type { ResumeDocument } from "${from}/types";

/** Tailored from ${source} — ${resume.sourceUrl} */
export const ${exportName}: ResumeDocument = {
  ...mainResume,
  id: ${JSON.stringify(resume.id)},
  tags: ${JSON.stringify(resume.tags)},${taglineLine}
  sourceUrl: ${JSON.stringify(resume.sourceUrl)},${searchLine}
  backgroundParagraphs: [
${background}
  ],
  workExperience: [
${jobs}
  ],
};
`;
}
