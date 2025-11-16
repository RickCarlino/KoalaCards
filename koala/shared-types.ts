import { z } from "zod";

export type Gender = "M" | "F" | "N";
export type LangCode = "ko";
export type LessonType = "speaking" | "new" | "remedial";
export type QuizResult = "error" | "fail" | "pass";

export const LANG_CODES = z.literal("ko");

export const supportedLanguages: Record<LangCode, string> = {
  ko: "Korean",
};
