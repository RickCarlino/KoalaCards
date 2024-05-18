import { errorReport } from "@/koala/error-report";
import { listening } from "./listening";
import { speaking } from "./speaking";
import { QuizEvaluator } from "./types";
import { dictation } from "./dictation";
import { LessonType } from "../shared-types";

const QUIZ_EVALUATORS: Record<LessonType, QuizEvaluator> = {
  listening,
  speaking,
  dictation,
};

export const getQuizEvaluator = (kind: LessonType): QuizEvaluator => {
  const evaluator = QUIZ_EVALUATORS[kind];
  if (!evaluator) {
    errorReport(`No evaluator found for quiz kind "${kind}"`);
  }
  return evaluator;
};
