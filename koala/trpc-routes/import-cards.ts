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

function fuzzNumber(num: number) {
  let pct = num * 0.2;
  let fuzzFactor = (Math.random() * 2 - 1) * pct;

  return num + fuzzFactor;
}

function scheduleNewCard(grade: Grade, now = Date.now()): SchedulingData {
  const x = FSRS.newCard(grade);
  const MINUTE = 60000;
  const grades: Record<Grade, number> = {
    [Grade.AGAIN]: 1 * MINUTE,
    [Grade.HARD]: 3 * MINUTE,
    [Grade.GOOD]: 5 * MINUTE,
    [Grade.EASY]: 3 * DAYS,
  };
  const nextReview = now + fuzzNumber(grades[grade]);

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
    nextReview: now + fuzzNumber(result.I * DAYS),
  };
}

export async function setGrade(
  quiz: GradedQuiz,
  grade: Grade,
  now = Date.now(),
) {
  const data = {
    ...quiz,
    ...calculateSchedulingData(quiz, grade, now),
    repetitions: (quiz.repetitions || 0) + 1,
    lastReview: now,
    firstReview: quiz.firstReview || now,
    lapses: (quiz.lapses || 0) + (grade === Grade.AGAIN ? 1 : 0),
  };

  const { id, nextReview } = await prismaClient.quiz.update({
    where: { id: quiz.id },
    data: {
      // Stats:
      difficulty: data.difficulty,
      lapses: data.lapses,
      repetitions: data.repetitions,
      stability: data.stability,
      // Timestamps:
      firstReview: data.firstReview,
      lastReview: data.lastReview,
      nextReview: data.nextReview,
    },
  });
  console.log(`Quiz ${id} next review: ${timeUntil(nextReview)}`);
}
