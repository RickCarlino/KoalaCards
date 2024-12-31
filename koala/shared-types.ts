import { z } from "zod";

export type Gender = "M" | "F" | "N";
export type LangCode =
  | "ar" // Arabic
  | "ca" // Catalan
  | "cn" // Chinese
  | "cs" // Czech
  | "da" // Danish
  | "de" // German
  | "el" // Greek
  | "en" // English
  | "es" // Spanish
  | "fi" // Finnish
  | "fr" // French
  | "gl" // Galician
  | "gu" // Gujarati
  | "he" // Hebrew
  | "hi" // Hindi
  | "hu" // Hungarian
  | "id" // Indonesian
  | "it" // Italian
  | "ja" // Japanese
  | "kn" // Kannada
  | "ko" // Korean
  | "lt" // Lithuanian
  | "lv" // Latvian
  | "mr" // Marathi
  | "ms" // Malay
  | "nb" // Norwegian (Bokmål)
  | "nl" // Dutch
  | "pa" // Punjabi
  | "pl" // Polish
  | "pt" // Portuguese
  | "ro" // Romanian
  | "ru" // Russian
  | "sk" // Slovak
  | "sr" // Serbian
  | "sv" // Swedish
  | "th"
  | "tr" // Turkish
  | "uk" // Ukrainian
  | "vi"; // Vietnamese // Thai
export type LessonType = "listening" | "speaking" | "dictation";
export type QuizResult = "error" | "fail" | "pass";
export type YesNo = "yes" | "no";

export const LANG_CODES = z.union([
  z.literal("ar"),
  z.literal("ca"),
  z.literal("cn"),
  z.literal("cs"),
  z.literal("da"),
  z.literal("de"),
  z.literal("el"),
  z.literal("en"),
  z.literal("es"),
  z.literal("fi"),
  z.literal("fr"),
  z.literal("gl"),
  z.literal("gu"),
  z.literal("he"),
  z.literal("hi"),
  z.literal("hu"),
  z.literal("id"),
  z.literal("it"),
  z.literal("ja"),
  z.literal("kn"),
  z.literal("ko"),
  z.literal("lt"),
  z.literal("lv"),
  z.literal("mr"),
  z.literal("ms"),
  z.literal("nb"),
  z.literal("nl"),
  z.literal("pa"),
  z.literal("pl"),
  z.literal("pt"),
  z.literal("ro"),
  z.literal("ru"),
  z.literal("sk"),
  z.literal("sr"),
  z.literal("sv"),
  z.literal("th"),
  z.literal("tr"),
  z.literal("uk"),
  z.literal("vi"),
]);

export const supportedLanguages: Record<LangCode, string> = {
  ar: "Arabic",
  ca: "Catalan",
  cn: "Chinese",
  cs: "Czech",
  da: "Danish",
  de: "German",
  el: "Greek",
  en: "English",
  es: "Spanish",
  fi: "Finnish",
  fr: "French",
  gl: "Galician",
  gu: "Gujarati",
  he: "Hebrew",
  hi: "Hindi",
  hu: "Hungarian",
  id: "Indonesian",
  it: "Italian",
  ja: "Japanese",
  kn: "Kannada",
  ko: "Korean",
  lt: "Lithuanian",
  lv: "Latvian",
  mr: "Marathi",
  ms: "Malay",
  nb: "Norwegian",
  nl: "Dutch",
  pa: "Punjabi",
  pl: "Polish",
  pt: "Portuguese",
  ro: "Romanian",
  ru: "Russian",
  sk: "Slovak",
  sr: "Serbian",
  sv: "Swedish",
  th: "Thai",
  tr: "Turkish",
  uk: "Ukrainian",
  vi: "Vietnamese",
};
