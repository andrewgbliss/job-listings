import { mainResume } from "../../main_resume";
import type { ResumeDocument } from "../../types";

/** Tailored from Search Results — https://www.google.com/search?q=ravens&sca_esv=ec77419bf80259b8&sxsrf=APpeQnvWyK9QZBhim8AFPUxlYjWdFZmu5Q%3A1789436329077&source=hp&ei=qaGoaof4AsDumLQP0YiUuQ4&iflsig=ABILxe8AAAAAaqivuV3TzI2haXc6LgPuVsspw3Mh5HHf&ved=0ahUKEwjH8Pblue-WAxVAN4YAHVEEJecQ4dUDCB8&uact=5&oq=ravens&gs_lp=Egdnd3Mtd2l6IgZyYXZlbnMyCxAuGIAEGLEDGIMBMgsQABiABBixAxiDATILEAAYgAQYsQMYgwEyCxAAGIAEGLEDGIMBMgsQABiABBixAxiDATIOEAAYgAQYigUYsQMYgwEyCxAAGIAEGLEDGIMBMg4QABiABBiKBRixAxiDATIIEAAYgAQYsQMyCBAAGIAEGLEDSIUNUNMDWIoLcAF4AJABAJgBMqABgAKqAQE2uAEDyAEA-AEBmAIHoAKWAqgCCsICChAAGAMYjwEY6gLCAgoQLhgDGI8BGOoCwgIOEC4YgAQYsQMYxwEY0QPCAhEQLhiABBixAxiDARjHARjRA8ICFBAuGIAEGIoFGI0GGLEDGMcBGNEDwgIIEC4YgAQYsQPCAhEQLhiDARixAxiABBiKBRiNBsICDhAuGIAEGIoFGLEDGIMBwgILEC4YgAQYxwEY0QPCAhEQABiABBiKBRiNBhixAxiDAZgDBfEFEzG6ivxlQGmSBwE3oAe9TbIHATa4B5ACwgcFMC42LjHIBw-ACAE&sclient=gws-wiz&sei=rKGoat2hKePtmLQP3Om2mAU */
export const jobSearchResume: ResumeDocument = {
  ...mainResume,
  id: "job-search",
  tags: ["Next.js"],
  sourceUrl: "https://www.google.com/search?q=ravens&sca_esv=ec77419bf80259b8&sxsrf=APpeQnvWyK9QZBhim8AFPUxlYjWdFZmu5Q%3A1789436329077&source=hp&ei=qaGoaof4AsDumLQP0YiUuQ4&iflsig=ABILxe8AAAAAaqivuV3TzI2haXc6LgPuVsspw3Mh5HHf&ved=0ahUKEwjH8Pblue-WAxVAN4YAHVEEJecQ4dUDCB8&uact=5&oq=ravens&gs_lp=Egdnd3Mtd2l6IgZyYXZlbnMyCxAuGIAEGLEDGIMBMgsQABiABBixAxiDATILEAAYgAQYsQMYgwEyCxAAGIAEGLEDGIMBMgsQABiABBixAxiDATIOEAAYgAQYigUYsQMYgwEyCxAAGIAEGLEDGIMBMg4QABiABBiKBRixAxiDATIIEAAYgAQYsQMyCBAAGIAEGLEDSIUNUNMDWIoLcAF4AJABAJgBMqABgAKqAQE2uAEDyAEA-AEBmAIHoAKWAqgCCsICChAAGAMYjwEY6gLCAgoQLhgDGI8BGOoCwgIOEC4YgAQYsQMYxwEY0QPCAhEQLhiABBixAxiDARjHARjRA8ICFBAuGIAEGIoFGI0GGLEDGMcBGNEDwgIIEC4YgAQYsQPCAhEQLhiDARixAxiABBiKBRiNBsICDhAuGIAEGIoFGLEDGIMBwgILEC4YgAQYxwEY0QPCAhEQABiABBiKBRiNBhixAxiDAZgDBfEFEzG6ivxlQGmSBwE3oAe9TbIHATa4B5ACwgcFMC42LjHIBw-ACAE&sclient=gws-wiz&sei=rKGoat2hKePtmLQP3Om2mAU",
  backgroundParagraphs: [
    "Senior Full-Stack Software Engineer in Lehi, UT. Builds production software in Next.js, with a bias toward performance.",
    "At Carketa and Odd Tipper, shipped Next.js web applications, APIs, and data pipelines — cut dashboard query time 75%; cut browser release time 40%.",
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
        "Next.js",
        "React",
        "TypeScript",
        "Tailwind",
        "PostgreSQL",
        "Docker",
        "Kubernetes",
        "GCP",
        "ArgoCD",
        "Claude",
        "Cursor",
        "BigQuery",
        "Cloud Storage",
        "CI/CD",
        "DevOps",
      ],
      bulletpoints: [
        "Led a legacy PHP → React/Next.js migration; modernized core workflows and improved maintainability.",
        "Designed a vehicle reconditioning system (tasks, photos, real-time seller REST API sync) adopted by 10 new dealerships per month.",
        "Built a daily BigQuery + PostgreSQL pipeline (partitioning, materialized views, indexes) that cut dashboard query time 75% as vehicle volume grew.",
      ],
    },
    {
      company: "Odd Tipper",
      location: {
        city: "Lehi",
        state: "UT",
        postalCode: "84043",
        country: "United States",
      },
      from: new Date(2018, 0, 1),
      to: new Date(2022, 11, 1),
      skills: [
        "Unity",
        "C#",
        "2D",
        "Browser games",
        "itch.io",
      ],
      bulletpoints: [
        "Built and published Unity browser games on itch.io.",
        "Ported Kana Balloons to Unity for WebGL play.",
        "Owned prototyping, juice, deploy, and itch.io pages for arcade and seasonal titles; cut browser release time 40%.",
      ],
    },
    {
      company: "Encore Solar",
      location: {
        city: "Lehi",
        state: "UT",
        postalCode: "84043",
        country: "United States",
      },
      from: new Date(2017, 11, 1),
      to: new Date(2022, 8, 1),
      skills: [
        "Next.js",
        "React",
        "TypeScript",
        "PostgreSQL",
        "Docker",
        "Kubernetes",
        "GCP",
        "CI/CD",
        "DevOps",
      ],
      bulletpoints: [
        "Led PHP → React/Next.js rewrite of a solar appraisal platform; hundreds of companies signed up to manage and sell installation contracts.",
        "Replaced polling support with a Node.js/Redis queue; cut wait times 25% with zero downtime.",
        "Shipped a custom solar proposal tool that raised revenue 10%.",
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
        "Next.js",
        "React",
        "TypeScript",
        "Angular",
        "Tailwind",
        "PostgreSQL",
        "Oracle",
        "Java",
        "Node.js",
        "Express",
        "Redis",
        "Docker",
      ],
      bulletpoints: [
        "Built a B2B KPI dashboard for SMBs.",
        "Wired in hundreds of backend REST API data sources.",
        "Served it from Node/Express with Oracle, PostgreSQL, and Redis; UI in Angular and React — cut report refresh time 50%.",
      ],
    }
  ],
};
