import { z } from "zod";

export const reviewGrades = [
  "correct",
  "mostly_correct",
  "slightly_incorrect",
  "incorrect",
] as const;
export const reviewGradeSchema = z.enum(reviewGrades);
export type ReviewGrade = z.infer<typeof reviewGradeSchema>;

export const gradeBuckets = {
  correct: { label: "Correct", isCorrect: true },
  mostly_correct: { label: "Mostly correct", isCorrect: true },
  slightly_incorrect: { label: "Slightly incorrect", isCorrect: false },
  incorrect: { label: "Incorrect", isCorrect: false },
} satisfies Record<ReviewGrade, { label: string; isCorrect: boolean }>;
