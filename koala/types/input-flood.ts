import { z } from "zod";

// Tunable constants used by Input Flood routes/prompts
/**
 * Maximum number of example sentences allowed in a single flood section
 * (applies to both target and contrast items).
 */
export const FLOOD_ITEM_COUNT_MAX = 4;

/**
 * Minimum number of example sentences required in a flood section
 * (applies to both target and contrast items).
 */
export const FLOOD_ITEM_COUNT_MIN = 2;

/**
 * Max tokens for the lesson generation structured output request
 * (inputFloodGenerate -> generateStructuredOutput).
 */
export const INPUT_FLOOD_GENERATE_MAX_TOKENS = 12000;

/**
 * Maximum number of grading items accepted per request
 * (enforced via Zod and by slicing the passed list).
 */
export const INPUT_FLOOD_GRADE_ITEMS_MAX = 4;

/**
 * Minimum number of grading items required per request
 * (enforced via Zod on the grade input schema).
 */
export const INPUT_FLOOD_GRADE_ITEMS_MIN = 1;

/**
 * Max tokens for the grading structured output request
 * (inputFloodGrade -> generateStructuredOutput).
 */
export const INPUT_FLOOD_GRADE_MAX_TOKENS = 1500;

/**
 * Character limit applied to grading text fields (prompt_en, answer, attempt)
 * before sending them to the model for grading.
 */
export const INPUT_FLOOD_GRADE_TEXT_LIMIT = 200;

/**
 * Maximum number of production Q&A items returned in a lesson.
 */
export const INPUT_FLOOD_PRODUCTION_MAX = 6;

/**
 * Minimum number of production Q&A items required in a lesson.
 */
export const INPUT_FLOOD_PRODUCTION_MIN = 3;

// (Removed) Previously duplicated prompt-specific rule bounds; use RULES_COUNT_MIN/MAX instead.

/**
 * Number of recent, unreviewed wrong quiz results to sample from
 * when picking a source result for lesson generation.
 */
export const INPUT_FLOOD_RECENT_RESULTS_TAKE = 100;

/**
 * Maximum number of words allowed per flood sentence (used in prompt
 * instructions to keep sentences short and comprehensible).
 */
export const INPUT_FLOOD_SENTENCE_MAX_WORDS = 12;

/**
 * Maximum character length for the diagnosis error_explanation field
 * in the generated lesson (enforced by Zod).
 */
export const INPUT_FLOOD_WHY_ERROR_MAX_CHARS = 240;

/**
 * Maximum number of rules permitted in the structured lesson output
 * (Zod constraint for the diagnosis.rules array).
 */
export const RULES_COUNT_MAX = 3;

/**
 * Minimum number of rules required in the structured lesson output
 * (Zod constraint for the diagnosis.rules array).
 */
export const RULES_COUNT_MIN = 1;

/**
 * Number of items shown in the UI picks list on the Input Flood page
 * (server-side query limit for visible recent mistakes).
 */
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
