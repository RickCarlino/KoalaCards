import { z } from "zod";
import { generateStructuredOutput } from "../ai";
import type { CoreMessage } from "../ai-types";
import {
  gradeCriteria,
  gradeExamples,
  gradingPolicy,
  speakingGradeSchema,
  type SpeakingGradingInput,
} from "./grading-policy";

export const speakingFeedbackSchema = z.object({
  grade: speakingGradeSchema,
  feedback: z.string().trim().min(1),
});

type SpeakingFeedback = z.infer<typeof speakingFeedbackSchema>;

export type SpeakingEvaluation = SpeakingFeedback & {
  isCorrect: boolean;
  gradingSource: "openai";
};

type SpeakingGrader = (input: SpeakingGradingInput) => Promise<unknown>;

export function buildSpeakingMessages(
  input: SpeakingGradingInput,
): CoreMessage[] {
  return [
    {
      role: "system",
      content: [
        gradingPolicy,
        gradeExamples,
        ...Object.entries(gradeCriteria).map(
          ([grade, criteria]) => `${grade}: ${criteria}`,
        ),
        "Make an independent final judgment. Return correct, partially_correct, or incorrect. An explicit give-up response is incorrect, unless it answers the prompt. If the text is insufficient to assess recall, use incorrect without inventing an intended answer.",
        "Give very brief feedback in English. For partially_correct, identify the actual problem and give a minimal Korean correction that preserves the learner's phrasing. Keep grade labels out of the feedback. For incorrect, briefly explain the core mismatch. For correct, simply confirm success. Do not discuss models, confidence, or grading rules.",
      ].join(" "),
    },
    {
      role: "user",
      content: JSON.stringify({
        prompt: input.prompt,
        possibleAnswer: input.possibleAnswer,
        response: input.response,
        ...(input.deckName ? { deckName: input.deckName } : {}),
        ...(input.deckDescription
          ? { deckDescription: input.deckDescription }
          : {}),
      }),
    },
  ];
}

const defaultGrader: SpeakingGrader = (input) =>
  generateStructuredOutput({
    model: "grading",
    messages: buildSpeakingMessages(input),
    schema: speakingFeedbackSchema,
  });

export async function evaluateSpeakingResponse(
  input: SpeakingGradingInput,
  grader: SpeakingGrader = defaultGrader,
): Promise<SpeakingEvaluation> {
  const evaluation = speakingFeedbackSchema.parse(await grader(input));
  return {
    ...evaluation,
    feedback:
      evaluation.grade === "partially_correct"
        ? `${evaluation.feedback} (slightly off)`
        : evaluation.feedback,
    isCorrect: evaluation.grade !== "incorrect",
    gradingSource: "openai",
  };
}
