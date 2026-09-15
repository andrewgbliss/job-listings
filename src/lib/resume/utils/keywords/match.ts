import type { KeywordPack } from "./types";

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function aliasesFor(skill: string, pack: KeywordPack) {
  const key = normalize(skill);
  const entry = pack.skills.find(
    (item) =>
      normalize(item.name) === key ||
      item.aliases.some((alias) => normalize(alias) === key),
  );
  return entry ?? { name: skill, aliases: [key], pattern: undefined };
}

export function skillHitsKeyword(
  skill: string,
  haystack: string,
  pack: KeywordPack,
) {
  const text = normalize(haystack);
  const entry = aliasesFor(skill, pack);
  if (entry.pattern) {
    return entry.pattern.test(text);
  }
  return entry.aliases.some((alias) => {
    if (alias.length <= 4) {
      return new RegExp(`(?<![\\w.])${escapeRegExp(alias)}(?![\\w])`, "i").test(
        text,
      );
    }
    return text.includes(alias);
  });
}

export function findKeywordSkills(text: string, pack: KeywordPack) {
  const haystack = normalize(text);
  return pack.skills
    .filter((skill) => skill.pattern.test(haystack))
    .sort((a, b) => haystack.search(a.pattern) - haystack.search(b.pattern))
    .map((skill) => skill.name);
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
