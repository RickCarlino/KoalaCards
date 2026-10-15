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
        "Write directly to the learner in brief English, using at most three short sentences. When there is a genuine error, explain the specific Korean issue and give a minimal correction preserving the learner's phrasing. For an acceptable answer, briefly explain why it expresses the intended meaning.",
        "Treat the rubric and saved grade as internal context only. Do not mention grade labels, buckets, saved results, grading rules, or whether a grade fits. Do not repeat the on-screen verdict or discuss APIs, models, confidence, or study scheduling.",
        "Do not invent errors to justify the saved grade. If the answer is acceptable under the rubric, explain why it works even when the saved grade says otherwise. You cannot change the saved grade or study schedule.",
        'Example feedback for using 단편 instead of 단순 to mean simple: 단편 means "fragment" or "short piece." For "simple," use 단순: 단순하지만 세련됐어요.',
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
