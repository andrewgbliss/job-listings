import { mainResume } from "../../main_resume";
import type { ResumeDocument } from "../../types";

/** Tailored from https://www.linkedin.com/jobs/view/4434809153 — https://www.linkedin.com/jobs/view/4434809153 */
export const job4434809153Resume: ResumeDocument = {
  ...mainResume,
  id: "job-4434809153",
  tags: ["JavaScript"],
  sourceUrl: "https://www.linkedin.com/jobs/view/4434809153",
  backgroundParagraphs: [
    "Senior Full-Stack Software Engineer in Lehi, UT. B.S. Computer Science, Stevens-Henager College. Builds production software in JavaScript, React, and Angular, with a bias toward performance.",
    "At Carketa and Grow, shipped JavaScript, React, and Angular web applications, APIs, and data pipelines — Cut hybrid BigQuery + PostgreSQL analytics cost 40%; cut report refresh time 50%.",
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
        "JavaScript",
        "React",
        "TypeScript",
        "Tailwind CSS",
        "PostgreSQL",
        "AI-assisted development",
      ],
      bulletpoints: [
        "Use AI for exploration, codegen, and tests in React/TypeScript/Next.js, then harden with profiling, review, and production checks.",
        "Ship AI-backed features end to end (scope, UX, REST APIs, rollout) without dropping review, observability, or security.",
        "Cut hybrid BigQuery + PostgreSQL analytics cost 40%; kept data ready for reporting and automation.",
      ],
    },
    {
      company: "Grow",
      location: {
        city: "Orem",
        state: "UT",
        postalCode: "84057",
        country: "United States",
      },
      from: new Date(2014, 7, 10),
      to: new Date(2017, 11, 1),
      skills: [
        "JavaScript",
        "React",
        "Angular",
        "TypeScript",
        "Express",
        "Tailwind",
        "PostgreSQL",
        "Oracle",
        "Redis",
        "Docker",
      ],
      bulletpoints: [
        "Served it from Node/Express with Oracle, PostgreSQL, and Redis; UI in Angular and React — cut report refresh time 50%.",
        "Built a B2B KPI dashboard for SMBs.",
        "Wired in hundreds of backend REST API data sources.",
      ],
    },
    {
      company: "Zagg",
      location: {
        city: "Salt Lake City",
        state: "UT",
        postalCode: "84101",
        country: "United States",
      },
      from: new Date(2009, 9, 5),
      to: new Date(2014, 7, 10),
      skills: [
        "JavaScript",
        "CSS",
        "HTML",
        "PHP",
        "CodeIgniter",
        "MySQL",
        "jQuery",
      ],
      bulletpoints: [
        "Shipped the store-ops UI in JavaScript, jQuery, CSS, and HTML; cut order-processing time 30%.",
        "Built a custom PHP/CodeIgniter backend for shipping, finance, inventory, and custom orders.",
        "Modeled MySQL data for orders, stock, and financial records.",
      ],
    },
    {
      company: "Stevens-Henager College",
      location: {
        city: "Salt Lake City",
        state: "UT",
        postalCode: "84101",
        country: "United States",
      },
      from: new Date(2002, 3, 2),
      to: new Date(2006, 9, 1),
      skills: [
        "JavaScript",
        "CSS",
        "HTML",
        "ColdFusion",
        "Oracle",
        ".NET",
      ],
      bulletpoints: [
        "Delivered the staff UI in ColdFusion, JavaScript, CSS, and HTML.",
        "Built the school backend for student records, finances, schedules, and testing.",
        "Stored academic data in Oracle; cut record lookup time 40%.",
      ],
    }
  ],
};
