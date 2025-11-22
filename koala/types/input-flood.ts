import { z } from "zod";

export const FLOOD_ITEM_COUNT_MAX = 2;

export const FLOOD_ITEM_COUNT_MIN = 1;

export const INPUT_FLOOD_GENERATE_MAX_TOKENS = 3000;

export const INPUT_FLOOD_GRADE_ITEMS_MAX = 4;

export const INPUT_FLOOD_GRADE_ITEMS_MIN = 1;

export const INPUT_FLOOD_GRADE_MAX_TOKENS = 1500;

export const INPUT_FLOOD_GRADE_TEXT_LIMIT = 200;

export const INPUT_FLOOD_PRODUCTION_MAX = 2;

export const INPUT_FLOOD_PRODUCTION_MIN = 1;

export const INPUT_FLOOD_RECENT_RESULTS_TAKE = 100;

export const INPUT_FLOOD_SENTENCE_MAX_WORDS = 12;

export const INPUT_FLOOD_WHY_ERROR_MAX_CHARS = 240;

export const RULES_COUNT_MAX = 3;

export const RULES_COUNT_MIN = 1;

export const INPUT_FLOOD_UI_PICKS_TAKE = 12;

export const SentenceSchema = z.object({
  text: z.string(),
  en: z.string(),
});

const floodInfo = z.object({
  label: z.string(),
  items: z
    .array(SentenceSchema)
    .min(FLOOD_ITEM_COUNT_MIN)
    .max(FLOOD_ITEM_COUNT_MAX),
});

export const InputFloodLessonSchema = z.object({
  diagnosis: z.object({
    original: z.string(),
    corrected: z.string(),
    error_explanation: z.string().max(INPUT_FLOOD_WHY_ERROR_MAX_CHARS),
    rules: z.array(z.string()).min(RULES_COUNT_MIN).max(RULES_COUNT_MAX),
  }),
  flood: z.object({
    target: floodInfo,
    contrast: floodInfo.nullable().optional(),
  }),
  production: z
    .array(
      z.object({
        prompt_en: z.string(),
        answer: z.string(),
      }),
    )
    .min(INPUT_FLOOD_PRODUCTION_MIN)
    .max(INPUT_FLOOD_PRODUCTION_MAX),
});

export type InputFloodLesson = z.infer<typeof InputFloodLessonSchema>;
