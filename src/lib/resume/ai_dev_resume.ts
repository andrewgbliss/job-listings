import { mainResume } from "./main_resume";
import type { ResumeDocument } from "./types";

export const aiDevResume: ResumeDocument = {
  ...mainResume,
  id: "ai-dev",
  tags: ["AI", "Full-Stack"],
  tagline: "Senior Full-Stack Engineer · AI-native delivery",
  backgroundParagraphs: [
    "Senior full-stack engineer who ships with AI in the loop: product features, APIs, and data systems—then hardens the result with review, tests, and production discipline.",
  ],
  workExperience: [
    {
      company: "Carketa",
      location: {
        city: "Lehi",
        state: "UT",
        postalCode: "84043",
        country: "United States",
      },
      from: new Date(2022, 8, 1),
      to: new Date(),
      skills: [
        "React",
        "TypeScript",
        "Tailwind CSS",
        "Node.js",
        "PostgreSQL",
        "AI-assisted development",
      ],
      bulletpoints: [
        "Ship AI-backed features end to end (scope, UX, APIs, rollout) without dropping review, observability, or security.",
        "Cut hybrid BigQuery + PostgreSQL analytics cost 40%; kept data ready for reporting and automation.",
        "Use AI for exploration, codegen, and tests in React/TypeScript/Next.js, then harden with profiling, review, and production checks.",
      ],
    },
  ],
};
