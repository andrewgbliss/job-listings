import type { KeywordPack } from "./types";

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Ordinary words that are also skill names. "go" is not Go; "Golang" is. */
const COMMON_WORD_ALIASES = new Set([
  "go",
  "rest",
  "express",
  "node",
  "react",
  "canvas",
  "cursor",
  "oracle",
  "sass",
]);

function aliasesFor(skill: string, pack: KeywordPack) {
  const key = normalize(skill);
  const entry = pack.skills.find(
    (item) =>
      normalize(item.name) === key ||
      item.aliases.some((alias) => normalize(alias) === key),
  );
  return entry ?? { name: skill, aliases: [key], pattern: undefined };
}

function tokenCountsAsSkill(token: string) {
  const trimmed = token.trim();
  if (!COMMON_WORD_ALIASES.has(trimmed.toLowerCase())) {
    return true;
  }
  return /[A-Z]/.test(trimmed);
}

function globalPattern(pattern: RegExp) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const withCase = flags.includes("i") ? flags : `${flags}i`;
  return new RegExp(pattern.source, withCase);
}

function firstSkillMatch(pattern: RegExp, text: string) {
  for (const match of text.matchAll(globalPattern(pattern))) {
    if (match.index == null || !tokenCountsAsSkill(match[0])) {
      continue;
    }
    return match.index;
  }
  return -1;
}

function aliasHits(alias: string, text: string) {
  const escaped = escapeRegExp(alias);
  const pattern =
    alias.length <= 4
      ? new RegExp(`(?<![\\w.])${escaped}(?![\\w])`, "gi")
      : new RegExp(escaped, "gi");
  for (const match of text.matchAll(pattern)) {
    if (tokenCountsAsSkill(match[0])) {
      return true;
    }
  }
  return false;
}

export function skillHitsKeyword(
  skill: string,
  haystack: string,
  pack: KeywordPack,
  options: { ignoreCase?: boolean } = {},
) {
  const entry = aliasesFor(skill, pack);
  if (options.ignoreCase) {
    const text = normalize(haystack);
    if (entry.pattern) {
      return entry.pattern.test(text);
    }
    return entry.aliases.some((alias) => {
      if (alias.length <= 4) {
        return new RegExp(
          `(?<![\\w.])${escapeRegExp(alias)}(?![\\w])`,
          "i",
        ).test(text);
      }
      return text.includes(alias);
    });
  }
  if (entry.pattern) {
    return firstSkillMatch(entry.pattern, haystack) >= 0;
  }
  return entry.aliases.some((alias) => aliasHits(alias, haystack));
}

export function findKeywordSkills(text: string, pack: KeywordPack) {
  return pack.skills
    .map((skill) => ({ skill, index: firstSkillMatch(skill.pattern, text) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.skill.name);
}

export function findKeywordPhrases(text: string, pack: KeywordPack) {
  return pack.phrases
    .filter((item) => item.pattern.test(text))
    .map((item) => item.phrase);
}

export function findKeywordValues(text: string, pack: KeywordPack) {
  const haystack = normalize(text);
  return pack.values.filter((value) => haystack.includes(value));
}
