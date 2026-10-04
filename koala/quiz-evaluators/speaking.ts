import { z } from "zod";
import { evaluateJev, generateStructuredOutput } from "../ai";
import type { CoreMessage } from "../ai-types";
import {
  gradeCriteria,
  gradeExamples,
  gradingPolicy,
  speakingGradeSchema,
  type SpeakingGradingInput,
} from "./grading-policy";
import {
  buildJevRequest,
  jevResponseSchema,
  type JevResponse,
} from "./jev";

export const CONFIDENCE_CUTTOFF = 0.85;

export const speakingFeedbackSchema = z.object({
  grade: speakingGradeSchema,
  feedback: z.string().trim().min(1),
});

type SpeakingFeedback = z.infer<typeof speakingFeedbackSchema>;
type JevJudgment = JevResponse["answers"]["grade"];

export type SpeakingEvaluation = SpeakingFeedback & {
  isCorrect: boolean;
  gradingSource: "jev" | "openai";
  jevGrade: JevJudgment["choice"] | null;
  jevConfidence: number | null;
};

type SpeakingGraders = {
  jev: (input: SpeakingGradingInput) => Promise<unknown>;
  openai: (input: SpeakingGradingInput) => Promise<unknown>;
};

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
      content: JSON.stringify(buildJevRequest(input, "jev-latest").state),
    },
  ];
}

const defaultGraders: SpeakingGraders = {
  jev: (input) =>
    evaluateJev(buildJevRequest(input, "jev-latest"), {
      apiKey: process.env.TYPESAFE_API_KEY ?? "",
    }),
  openai: (input) =>
    generateStructuredOutput({
      model: "grading",
      messages: buildSpeakingMessages(input),
      schema: speakingFeedbackSchema,
    }),
};

async function tryJev(
  input: SpeakingGradingInput,
  grader: SpeakingGraders["jev"],
): Promise<JevJudgment | null> {
  try {
    return jevResponseSchema.parse(await grader(input)).answers.grade;
  } catch {
    console.warn("JEV grading unavailable; falling back to OpenAI.");
    return null;
  }
}

function trustedJevFeedback(
  judgment: JevJudgment | null,
): SpeakingFeedback | null {
  if (!judgment || judgment.confidence <= CONFIDENCE_CUTTOFF) {
    return null;
  }
  if (judgment.choice === "correct") {
    return { grade: "correct", feedback: "Correct!" };
  }
  if (judgment.choice === "user_gave_up") {
    return { grade: "incorrect", feedback: "No answer given." };
  }
  return null;
}

export async function evaluateSpeakingResponse(
  input: SpeakingGradingInput,
  graders: SpeakingGraders = defaultGraders,
): Promise<SpeakingEvaluation> {
  const judgment = await tryJev(input, graders.jev);
  const trusted = trustedJevFeedback(judgment);
  const evaluation =
    trusted ?? speakingFeedbackSchema.parse(await graders.openai(input));
  return {
    ...evaluation,
    feedback:
      evaluation.grade === "partially_correct"
        ? `${evaluation.feedback} (very close)`
        : evaluation.feedback,
    isCorrect: evaluation.grade !== "incorrect",
    gradingSource: trusted ? "jev" : "openai",
    jevGrade: judgment?.choice ?? null,
    jevConfidence: judgment?.confidence ?? null,
  };
}
