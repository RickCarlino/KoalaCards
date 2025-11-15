import { z } from "zod";

export type Gender = "M" | "F" | "N";
export type LangCode =
  | "en" // English
  | "ko"; // Vietnamese
export type LessonType = "speaking" | "new" | "remedial";
export type QuizResult = "error" | "fail" | "pass";

export const LANG_CODES = z.union([z.literal("en"), z.literal("ko")]);

export const supportedLanguages: Record<LangCode, string> = {
  en: "English",
  ko: "Korean",
};
