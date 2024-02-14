import { errorReport } from "@/utils/error-report";
import { listening } from "./listening";
import { speaking } from "./speaking";
import { QuizEvaluator } from "./types";

const QUIZ_EVALUATORS: Record<string, QuizEvaluator> = {
  listening,
  speaking,
};

export const getQuizEvaluator = (kind: string): QuizEvaluator => {
  const evaluator = QUIZ_EVALUATORS[kind];
  if (!evaluator) {
    errorReport(`No evaluator found for quiz kind "${kind}"`);
  }
  return evaluator;
};
