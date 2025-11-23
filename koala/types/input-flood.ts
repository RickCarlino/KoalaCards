import { z } from "zod";

export const INPUT_FLOOD_GENERATE_MAX_TOKENS = 3000;

export const INPUT_FLOOD_GRADE_ITEMS_MAX = 4;

export const INPUT_FLOOD_GRADE_ITEMS_MIN = 1;

export const INPUT_FLOOD_GRADE_MAX_TOKENS = 1500;

export const INPUT_FLOOD_GRADE_TEXT_LIMIT = 200;

export const INPUT_FLOOD_RECENT_RESULTS_TAKE = 100;

export const INPUT_FLOOD_SENTENCE_MAX_WORDS = 12;

export const INPUT_FLOOD_WHY_ERROR_MAX_CHARS = 240;

export const INPUT_FLOOD_UI_PICKS_TAKE = 12;

export const SentenceSchema = z.object({
  text: z.string(),
  en: z.string(),
});

const floodExample = z.object({
  label: z.string(),
  example: SentenceSchema,
});

export const InputFloodLessonSchema = z.object({
  diagnosis: z.object({
    original: z.string(),
    corrected: z.string(),
    error_explanation: z.string().max(INPUT_FLOOD_WHY_ERROR_MAX_CHARS),
  }),
  target: floodExample,
  contrast: floodExample.nullable().optional(),
  production: z.object({
    prompt_en: z.string(),
    answer: z.string(),
  }),
});

export type InputFloodLesson = z.infer<typeof InputFloodLessonSchema>;
