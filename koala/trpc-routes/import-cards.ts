import { Grade } from "femto-fsrs";
import { prismaClient } from "../prisma-client";
import { Quiz } from "@prisma/client";
import { timeUntil } from "@/koala/time-until";
import { calculateSchedulingData } from "./calculate-scheduling-data";

type QuizGradingFields =
  | "difficulty"
  | "firstReview"
  | "id"
  | "lapses"
  | "lastReview"
  | "repetitions"
  | "stability";

type GradedQuiz = Pick<Quiz, QuizGradingFields>;

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
      ...(grade === Grade.AGAIN
        ? { Card: { update: { lastFailure: now } } }
        : {}),
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
