import { z } from "zod";

export type Gender = "M" | "F" | "N";
export type LangCode =
  | "ca" // Catalan
  | "cs" // Czech
  | "da" // Danish
  | "nl" // Dutch
  | "en" // English
  | "es" // Spanish
  | "fi" // Finnish
  | "fr" // French
  | "gl" // Galician
  | "de" // German
  | "el" // Greek
  | "gu" // Gujarati
  | "hi" // Hindi
  | "hu" // Hungarian
  | "id" // Indonesian
  | "it" // Italian
  | "ja" // Japanese
  | "kn" // Kannada
  | "ko" // Korean
  | "lv" // Latvian
  | "lt" // Lithuanian
  | "ms" // Malay
  | "mr" // Marathi
  | "nb" // Norwegian (Bokmål)
  | "pl" // Polish
  | "pt" // Portuguese
  | "pa" // Punjabi
  | "ro" // Romanian
  | "ru" // Russian
  | "sr" // Serbian
  | "sk" // Slovak
  | "uk" // Ukrainian
  | "vi"; // Vietnamese
export type LessonType = "listening" | "speaking" | "dictation";
export type QuizResult = "error" | "fail" | "pass";
export type YesNo = "yes" | "no";

export const LANG_CODES = z.union([
  z.literal("ca"),
  z.literal("cs"),
  z.literal("da"),
  z.literal("nl"),
  z.literal("en"),
  z.literal("es"),
  z.literal("fi"),
  z.literal("fr"),
  z.literal("gl"),
  z.literal("de"),
  z.literal("el"),
  z.literal("gu"),
  z.literal("hi"),
  z.literal("hu"),
  z.literal("id"),
  z.literal("it"),
  z.literal("ja"),
  z.literal("kn"),
  z.literal("ko"),
  z.literal("lv"),
  z.literal("lt"),
  z.literal("ms"),
  z.literal("mr"),
  z.literal("nb"),
  z.literal("pl"),
  z.literal("pt"),
  z.literal("pa"),
  z.literal("ro"),
  z.literal("ru"),
  z.literal("sr"),
  z.literal("sk"),
  z.literal("uk"),
  z.literal("vi"),
]);
