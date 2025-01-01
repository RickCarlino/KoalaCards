import { LangCode, supportedLanguages } from "./shared-types";

export const getLangName = (lang: string) => {
  const key = lang.slice(0, 2).toLowerCase() as LangCode;
  return supportedLanguages[key] || lang;
};
