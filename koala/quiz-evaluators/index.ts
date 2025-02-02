import { errorReport } from "@/koala/error-report";
import { speaking } from "./speaking-evaluator";
import { QuizEvaluator } from "./types";
import { LessonType } from "../shared-types";

const NO_OP: QuizEvaluator = (_: unknown) => {
  return Promise.resolve({
    result: "error",
    userMessage: "Unknown quiz type",
  });
};

const QUIZ_EVALUATORS: Record<LessonType, QuizEvaluator> = {
  listening: NO_OP,
  dictation: NO_OP,
  review: NO_OP,
  speaking,
};

export const getQuizEvaluator = (kind: LessonType): QuizEvaluator => {
  const evaluator = QUIZ_EVALUATORS[kind];
  if (!evaluator) {
    return errorReport(`No evaluator found for quiz kind "${kind}"`);
  }
  return evaluator;
};
