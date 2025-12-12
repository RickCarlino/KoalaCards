import { LangCode, supportedLanguages } from "@/koala/shared-types";

export const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
export type Level = (typeof LEVELS)[number];

export const KOREAN_LANG_CODE: LangCode = "ko";
export const KOREAN_LANGUAGE_NAME =
  supportedLanguages[KOREAN_LANG_CODE] || "Korean";
export const DEFAULT_DECK_NAME = "My First Koala Deck";
export const ROTATE_PLACEHOLDER_EVERY_MS = 700;

export const PLACEHOLDERS = [
  "greetings and introductions",
  "numbers and counting",
  "telling the time",
  "days, months, seasons",
  "weather talk",
  "colors and shapes",
  "clothing and fashion",
  "directions and locations",
  "asking for help",
  "emergencies and safety",

  "airport check-in",
  "customs and immigration",
  "hotel check-in/out",
  "ordering taxis and rides",
  "public transport tickets",
  "navigating maps",
  "sightseeing and tours",
  "cultural etiquette",
  "asking for recommendations",
  "handling lost items",

  "restaurant conversations",
  "ordering drinks",
  "street food and markets",
  "dietary restrictions",
  "allergies and ingredients",
  "paying the bill",
  "making reservations",
  "coffee shop chats",
  "bar conversations",
  "cooking and recipes",

  "shopping and prices",
  "bargaining at markets",
  "paying for stuff",
  "credit cards and ATMs",
  "banking basics",
  "subscriptions and bills",
  "electronics shopping",
  "grocery shopping",
  "buying gifts",
  "returns and exchanges",

  "job interview practice",
  "office small talk",
  "meetings and presentations",
  "emails and phone calls",
  "introducing coworkers",
  "discussing projects",
  "student life",
  "classroom interactions",
  "giving a speech",
  "research and study habits",

  "daily routines",
  "household chores",
  "health and exercise",
  "doctor visits",
  "pharmacy and medicine",
  "sports and hobbies",
  "weekend plans",
  "appointments",
  "using technology",
  "social media",

  "family and friends",
  "dating and romance",
  "weddings and celebrations",
  "neighbors and community",
  "talking about feelings",
  "resolving conflicts",
  "parenting and children",
  "pets and animals",
  "birthdays",
  "holidays and traditions",

  "current events",
  "politics and government",
  "environment and nature",
  "science and technology",
  "art and literature",
  "music and entertainment",
  "religion and philosophy",
  "economics and business",
  "history and culture",
  "dreams and future plans",
] as const;

export function buildCardPrompt(params: {
  level: Level;
  topic: string;
}): string {
  return [
    `You are a ${KOREAN_LANGUAGE_NAME} language teacher that helps students learn by creating short example sentence flashcards.`,
    `the perfect example sentence is only a few syllables long.`,
    `the perfect example sentence uses common words and grammar suitable for a ${params.level.toLowerCase()} learner.`,
    `the learner said they are interested ${params.topic}.`,
    `Create 15 example sentences with English translations (do NOT include romanizations or pronunciations).`,
    `Use language that reflects how ${KOREAN_LANGUAGE_NAME} speakers actually talk in real life.`,
    `Do NOT come up with low quality english sentence and lazily translate them to the target language.`,
    `Authenticity is very important! Both in terms of the language used and the cultural context.`,
    `Use a variety of sentence structures and vocabulary.`,
  ].join("\n");
}
