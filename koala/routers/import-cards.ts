import { Grade, createDeck } from "femto-fsrs";
import { prismaClient } from "../prisma-client";
import { Quiz } from "@prisma/client";
import { timeUntil } from "@/koala/time-until";
import { errorReport } from "../error-report";

type QuizGradingFields =
  | "difficulty"
  | "firstReview"
  | "id"
  | "lapses"
  | "lastReview"
  | "repetitions"
  | "stability";
type GradedQuiz = Pick<Quiz, QuizGradingFields>;

const FSRS = createDeck({
  requestedRetentionRate: 0.87,
});

const DAYS = 24 * 60 * 60 * 1000;

type SchedulingData = {
  difficulty: number;
  stability: number;
  nextReview: number;
};
type PartialQuizKeys =
  | "difficulty"
  | "stability"
  | "lastReview"
  | "lapses"
  | "repetitions";
type PartialQuiz = Pick<Quiz, PartialQuizKeys>;

function scheduleNewCard(grade: Grade, now = Date.now()): SchedulingData {
  const x = FSRS.newCard(grade);
  const MINUTE = 60000;
  const grades: Record<Grade, number> = {
    [Grade.AGAIN]: 1 * MINUTE,
    [Grade.HARD]: 6 * MINUTE,
    [Grade.GOOD]: 10 * MINUTE,
    [Grade.EASY]: 5 * DAYS,
  };
  const nextReview = now + grades[grade];

  if (!nextReview || nextReview < now) {
    return errorReport(`Invalid new card grade: ${grade}`);
  }

  return {
    difficulty: x.D,
    stability: x.S,
    nextReview,
  };
}

export function calculateSchedulingData(
  quiz: PartialQuiz,
  grade: Grade,
  now = Date.now(),
): SchedulingData {
  if (quiz.lapses + quiz.repetitions === 0) {
    return scheduleNewCard(grade, now);
  }
  const fsrsCard = {
    D: quiz.difficulty,
    S: quiz.stability,
  };
  const past = (now - quiz.lastReview) / DAYS;
  const result = FSRS.gradeCard(fsrsCard, past, grade);
  return {
    difficulty: result.D,
    stability: result.S,
    nextReview: now + result.I * DAYS,
  };
}

export async function setGrade(
  quiz: GradedQuiz,
  grade: Grade,
  now = Date.now(),
) {
  const { id, nextReview } = await prismaClient.quiz.update({
    where: { id: quiz.id },
    data: {
      ...quiz,
      ...calculateSchedulingData(quiz, grade, now),
      repetitions: (quiz.repetitions || 0) + 1,
      lastReview: now,
      firstReview: quiz.firstReview || now,
      lapses: (quiz.lapses || 0) + (grade === Grade.AGAIN ? 1 : 0),
    },
  });
  console.log(`Quiz ${id} next review: ${timeUntil(nextReview)}`);
}
