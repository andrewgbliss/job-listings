function normalize(skill: string) {
  return skill.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Lower number = more important. */
export const skillWeights = {
  1: [
    "PHP",
    "React",
    "PostgreSQL",
    "Postgres",
    "TypeScript",
    "Next.js",
    "Node.js",
    "JavaScript",
    "Python",
    "Go",
    "Java",
    "C#",
    "Ruby",
    "Angular",
  ],
  3: ["HTML", "CSS", "Tailwind", "Tailwind CSS", "Sass", "DevOps", "Express"],
  4: [
    "Docker",
    "Kubernetes",
    "CI/CD",
    "GCP",
    "AWS",
    "Azure",
    "Terraform",
    "ArgoCD",
    "Linux",
    "Git",
    "GitHub",
    "Cloud Storage",
  ],
  2: [
    "MySQL",
    "MongoDB",
    "Redis",
    "Oracle",
    "SQL",
    "BigQuery",
    "GraphQL",
    "REST",
  ],
  5: [".NET"],
  6: [
    "jQuery",
    "Webpack",
    "Vite",
    "Angular",
    "Vue",
    "CodeIgniter",
    "ColdFusion",
    "Claude",
    "Cursor",
    "Canvas",
    "WebGL",
  ],
} as const;

const DEFAULT_WEIGHT = 50;

const weightBySkill = new Map<string, number>(
  Object.entries(skillWeights).flatMap(([weight, names]) =>
    names.map((name) => [normalize(name), Number(weight)] as const),
  ),
);

export function skillWeight(skill: string) {
  return weightBySkill.get(normalize(skill)) ?? DEFAULT_WEIGHT;
}

export function sortSkillsByWeight(skills: Array<string>) {
  return [...skills].sort((a, b) => skillWeight(a) - skillWeight(b));
}
