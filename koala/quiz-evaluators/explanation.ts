import { z } from "zod";
import { generateResponseStructuredOutput } from "../ai";
import type { CoreMessage } from "../ai-types";
import {
  buildGradingData,
  gradeCriteria,
  gradingPolicy,
  gradeExamples,
  type SpeakingGradingInput,
} from "./grading-policy";
import type { ReviewGrade } from "./grade-buckets";

export const reviewExplanationSchema = z.object({
  explanation: z.string().trim().min(1).max(2000),
});

export function buildExplanationMessages(
  input: SpeakingGradingInput,
  grade: ReviewGrade,
): CoreMessage[] {
  return [
    {
      role: "system",
      content: [
        gradingPolicy,
        gradeExamples,
        ...Object.entries(gradeCriteria).map(
          ([bucket, criteria]) => `${bucket}: ${criteria}`,
        ),
        "Explain the saved review result in brief English, using at most three sentences. When there is a genuine error, identify it and give a minimal Korean correction preserving the learner's phrasing. For a correct answer, briefly confirm why it works. Do not invent errors to justify the saved bucket. If the saved result conflicts with the rubric, say so plainly. You cannot change the saved grade or study schedule. Do not discuss APIs, models, or confidence.",
      ].join(" "),
    },
    {
      role: "user",
      content: JSON.stringify({ ...buildGradingData(input), grade }),
    },
  ];
}

export function explainReviewResponse(
  input: SpeakingGradingInput,
  grade: ReviewGrade,
) {
  return generateResponseStructuredOutput({
    model: "explanation",
    messages: buildExplanationMessages(input, grade),
    schema: reviewExplanationSchema,
    maxTokens: 2500,
  });
}
