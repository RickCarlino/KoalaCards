import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { OLD_BACKUP_SCHEMA } from "@/pages/cards";
import { Grade, createDeck } from "femto-fsrs";
import { prismaClient } from "../prisma-client";
import { getUserSettings } from "../auth-helpers";
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
  console.log(`Set first SRS scheduling: ${timeUntil(nextQuiz.nextReview)}`);
  await prismaClient.quiz.update({
    where: { id: quiz.id },
    data: nextQuiz,
  });
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

export const importCards = procedure
  .input(OLD_BACKUP_SCHEMA)
  .output(z.object({ count: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const userId = (await getUserSettings(ctx.user?.id)).user.id;
    let count = 0;
    for (const x of input) {
      const card = {
        term: x.term,
        definition: x.definition,
        gender: "N",
      };
      const where = { userId, term: card.term };
      const existingCard = await prismaClient.card.count({
        where,
      });
      if (!existingCard) {
        const { id: cardId } = await prismaClient.card.create({
          data: {
            flagged: false,
            definition: card.definition,
            term: card.term,
            langCode: "ko",
            userId,
            gender: "N",
          },
        });

        ["listening", "speaking"].map(async (quizType) => {
          await prismaClient.quiz.create({
            data: {
              cardId: cardId,
              quizType,
              stability: 0,
              difficulty: 0,
              firstReview: 0,
              lastReview: 0,
              nextReview: 0,
              lapses: 0,
              repetitions: 0,
            },
          });
        });
        count = count + 1;
      }
    }

    return { count };
  });