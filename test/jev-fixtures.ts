import type { SpeakingGradingInput } from "../koala/quiz-evaluators/grading-policy.ts";
import {
  jevGrades,
  type JevGrade,
  type JevResponse,
} from "../koala/quiz-evaluators/jev.ts";

export const speakingInput: SpeakingGradingInput = {
  prompt: "after pouring in water",
  possibleAnswer: "물을 부은 다음",
  response: "물을 부은 후",
};

export function jevResponse(
  choice: JevGrade = "correct",
  confidence = 0.9,
): JevResponse {
  const probabilities = Object.fromEntries(
    jevGrades.map((grade) => [
      grade,
      grade === choice
        ? confidence
        : (1 - confidence) / (jevGrades.length - 1),
    ]),
  ) as JevResponse["answers"]["grade"]["probabilities"];
  return {
    model: "jev-test",
    answers: {
      grade: { type: "choice", choice, confidence, probabilities },
      grammar_unnatural_wording: { type: "noul", noul: 0.1 },
      possible_transcription_issue: { type: "noul", noul: 0.2 },
    },
    usage: { input_tokens: 200, output_tokens: 30 },
  };
}
