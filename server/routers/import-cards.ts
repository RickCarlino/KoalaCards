import { z } from "zod";
import { procedure } from "../trpc";
import { OLD_BACKUP_SCHEMA } from "@/pages/cards";
import { Grade, createDeck } from "femto-fsrs";
import { prismaClient } from "../prisma-client";
import { getUserSettings } from "../auth-helpers";
import { Quiz } from "@prisma/client";
import { timeUntil } from "@/utils/time-until";

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

function getEaseBucket(ease: number): Grade {
  if (ease < 2.2) {
    return Grade.HARD;
  }

  if (ease > 2.85) {
    return Grade.EASY;
  }

  return Grade.GOOD;
}

// Take a date and create a new date that is randomly 0-3 days
// from the original date
function fuzzDate(date: Date) {
  const randomOffset = Math.floor(Math.random() * 3);
  return new Date(date.getTime() + randomOffset * DAYS).getTime();
}

type SchedulingData = {
  difficulty: number;
  stability: number;
  nextReview: number;
};

type PartialQuiz = Pick<Quiz, "difficulty" | "stability" | "lastReview">;

export function calculateSchedulingData(
  quiz: PartialQuiz,
  grade: Grade,
  now = Date.now(),
): SchedulingData {
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
  console.log(
    `(${data.data.id}) Update grade. Next review: ${timeUntil(data.data.nextReview)}`,
  );
  await prismaClient.quiz.update(data);
}

export const importCards = procedure
  .input(OLD_BACKUP_SCHEMA)
  .output(z.object({ count: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const userId = (await getUserSettings(ctx.user?.id)).user.id;
    let count = 0;
    for (const card of input) {
      const where = { userId, term: card.term };
      const existingCard = await prismaClient.card.count({
        where,
      });
      if (!existingCard) {
        const data = {
          flagged: false,
          definition: card.definition,
          langCode: "ko",
          ...where,
        };
        const { id: cardId } = await prismaClient.card.create({ data });

        ["listening", "speaking"].map(async (quizType) => {
          const grade = getEaseBucket(card.ease);
          const card0 = FSRS.newCard(grade);
          const nextReview = fuzzDate(new Date(card.nextReviewAt));
          console.log(`${cardId} due in ${timeUntil(nextReview)}`);
          await prismaClient.quiz.create({
            data: {
              cardId,
              quizType,
              stability: card0.S,
              difficulty: card0.D,
              firstReview: card.firstReview?.getTime() || 0,
              lastReview: card.lastReview?.getTime() || 0,
              nextReview,
              lapses: card.lapses,
              repetitions: card.repetitions,
            },
          });
        });
        count = count + 1;
      }
    }

    return { count };
  });
