import { classifyAIChoice, type ChoiceGenOptions } from "../ai";
import {
  gradeBuckets,
  reviewGrades,
  reviewGradeSchema,
} from "./grade-buckets";
import {
  buildGradingData,
  gradeCriteria,
  gradeExamples,
  gradingPolicy,
  type SpeakingGradingInput,
} from "./grading-policy";

export function buildReviewDecision(
  input: SpeakingGradingInput,
): ChoiceGenOptions {
  return {
    input: JSON.stringify(buildGradingData(input)),
    instructions: `${gradingPolicy} ${gradeExamples}`,
    choices: reviewGrades.map((value) => ({
      value,
      description: gradeCriteria[value],
    })),
  };
}

export async function evaluateSpeakingResponse(
  input: SpeakingGradingInput,
) {
  const result = await classifyAIChoice(buildReviewDecision(input));
  const grade = reviewGradeSchema.parse(result.choice);
  return {
    grade,
    feedback: gradeBuckets[grade].label,
    isCorrect: gradeBuckets[grade].isCorrect,
    gradingSource: "openai-decisions" as const,
    gradingModel: result.model,
    gradingConfidence: result.confidence,
  };
}
