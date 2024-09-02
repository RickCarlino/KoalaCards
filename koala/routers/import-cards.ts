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
  requestedRetentionRate: 0.85,
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
    [Grade.EASY]: x.I * DAYS,
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
    console.log(`=== Does this ever get hit? ===`);
    return scheduleNewCard(grade, now);
  }
  console.log(`=== NOPE! ===`);
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
  const x = await prismaClient.quiz.update(data);
  console.log(`Quiz ${data.data.id} next review: ${timeUntil(x.nextReview)}`);
}
