export type KeywordSkill = {
  name: string;
  aliases: Array<string>;
  pattern: RegExp;
};

export type KeywordPhrase = {
  phrase: string;
  pattern: RegExp;
};

export type KeywordPack = {
  id: string;
  skills: Array<KeywordSkill>;
  phrases: Array<KeywordPhrase>;
  values: Array<string>;
};
