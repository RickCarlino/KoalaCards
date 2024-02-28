import { Grade, createDeck } from "femto-fsrs";
import { prismaClient } from "../prisma-client";
import { Quiz } from "@prisma/client";
import { timeUntil } from "@/koala/time-until";

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
  // This is very low, but it prevents too many cards from
  // piling up immediately after an import.
  requestedRetentionRate: 0.79,
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
  return {
    difficulty: x.D,
    stability: x.S,
    nextReview: now + x.I * DAYS,
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

async function setGradeFirstTime(
  quiz: GradedQuiz,
  grade: Grade,
  now = Date.now(),
) {
  const result = FSRS.newCard(grade);
  const nextQuiz = {
    ...quiz,
    difficulty: result.D,
    stability: result.S,
    firstReview: now,
    lastReview: now,
    nextReview: now + result.I * DAYS,
    lapses: grade === Grade.AGAIN ? quiz.lapses + 1 : quiz.lapses,
    repetitions: 1,
  };
  await prismaClient.quiz.update({
    where: { id: quiz.id },
    data: nextQuiz,
  });
  console.log(`Set first SRS scheduling: ${timeUntil(nextQuiz.nextReview)}`);
}

export async function setGrade(
  quiz: GradedQuiz,
  grade: Grade,
  now = Date.now(),
) {
  if (!quiz.lastReview) {
    return setGradeFirstTime(quiz, grade, now);
  }
  const data = {
    where: { id: quiz.id },
    data: {
      ...quiz,
      firstReview: quiz.firstReview || now,
      lastReview: now,
      lapses: grade === Grade.AGAIN ? quiz.lapses + 1 : quiz.lapses,
      repetitions: quiz.repetitions + 1,
      ...calculateSchedulingData(quiz, grade, now),
    },
  };
  await prismaClient.quiz.update(data);
  console.log(
    `Quiz ${data.data.id} next review: ${timeUntil(data.data.nextReview)}`,
  );
}
