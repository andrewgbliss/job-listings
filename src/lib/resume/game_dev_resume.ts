import { mainResume } from "./main_resume";
import type { ResumeDocument } from "./types";

export const gameDevResume: ResumeDocument = {
  ...mainResume,
  id: "game-dev",
  tags: ["Game Developer"],
  tagline: "Game Developer",
  backgroundParagraphs: [
    "Independent game developer shipping arcade, puzzle, and adventure titles—browser-first prototypes through polished itch.io releases, with a focus on feel and iteration.",
  ],
  workExperience: [
    {
      company: "Goat Carrot Studios",
      url: "https://goatcarrotstudios.itch.io",
      location: {
        city: "Lehi",
        state: "UT",
        postalCode: "84043",
        country: "United States",
      },
      from: new Date(2022, 0, 1),
      to: new Date(),
      skills: [
        "Godot",
        "GDScript",
        "C#",
        "Game design",
        "itch.io",
        "Web export",
      ],
      bulletpoints: [
        "Ship Godot titles for browser and desktop: Kana Balloons, Cargo Boom, Rain Quest, Junkyard Quest, and Zelda One Co-op (parser adventure, arcade, co-op action).",
        "Release Godot tools (Blackboard, Jukebox); iterate puzzles, tilesets, and demos from player feedback — cut content iteration time 50%.",
        "Export and maintain Web and desktop builds on itch.io.",
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
      skills: ["Unity", "C#", "2D", "Browser games", "itch.io"],
      bulletpoints: [
        "Built and published Unity browser games on itch.io.",
        "Ported Kana Balloons to Unity for WebGL play.",
        "Owned prototyping, juice, deploy, and itch.io pages for arcade and seasonal titles; cut browser release time 40%.",
      ],
    },
  ],
};
