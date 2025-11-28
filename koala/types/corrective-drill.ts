import { z } from "zod";

export const CORRECTIVE_DRILL_GENERATE_MAX_TOKENS = 3000;

export const CORRECTIVE_DRILL_GRADE_ITEMS_MAX = 4;

export const CORRECTIVE_DRILL_GRADE_ITEMS_MIN = 1;

export const CORRECTIVE_DRILL_GRADE_MAX_TOKENS = 1500;

export const CORRECTIVE_DRILL_GRADE_TEXT_LIMIT = 200;

export const CORRECTIVE_DRILL_RECENT_RESULTS_TAKE = 100;

export const CORRECTIVE_DRILL_SENTENCE_MAX_WORDS = 12;

export const CORRECTIVE_DRILL_ERROR_MAX_CHARS = 240;

export const CORRECTIVE_DRILL_UI_PICKS_TAKE = 12;

export const SentenceSchema = z.object({
  text: z.string(),
  en: z.string(),
});

const drillExample = z.object({
  label: z.string(),
  example: SentenceSchema,
});

export const CorrectiveDrillLessonSchema = z.object({
  diagnosis: z.object({
    original: z.string(),
    corrected: z.string(),
    error_explanation: z.string().max(CORRECTIVE_DRILL_ERROR_MAX_CHARS),
  }),
  target: drillExample,
  contrast: drillExample.nullable().optional(),
  production: z.object({
    prompt_en: z.string(),
    answer: z.string(),
  }),
});

export type CorrectiveDrillLesson = z.infer<
  typeof CorrectiveDrillLessonSchema
>;
