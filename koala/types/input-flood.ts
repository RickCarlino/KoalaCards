import { z } from "zod";

export const SentenceSchema = z.object({
  text: z.string(),
  en: z.string(),
});

export const InputFloodLessonSchema = z.object({
  fix: z.object({ original: z.string(), corrected: z.string() }),
  diagnosis: z.object({
    target_label: z.string(),
    contrast_label: z.string().nullable().optional(),
    why_error: z.string().max(240),
    rules: z.array(z.string()).min(1).max(3),
  }),
  flood: z.object({
    A: z.array(SentenceSchema).min(2).max(4),
    B: z.array(SentenceSchema).min(2).max(4).nullable().optional(),
  }),
  production: z
    .array(
      z.object({
        prompt_en: z.string(),
        answer: z.string(),
      }),
    )
    .min(5)
    .max(6),
});

export type InputFloodLesson = z.infer<typeof InputFloodLessonSchema>;
