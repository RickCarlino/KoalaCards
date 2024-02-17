import { z } from "zod";
import { procedure } from "../trpc";
import { OLD_BACKUP_SCHEMA } from "@/pages/cards";
import { Grade, createDeck } from "femto-fsrs";
import { prismaClient } from "../prisma-client";
import { getUserSettings } from "../auth-helpers";
import { timeUntil } from "@/utils/srs";
import { Quiz } from "@prisma/client";

const FSRS = createDeck({
  // This is very low, but it prevents too many cards from
  // piling up imediately after an import.
  requestedRetentionRate: 0.79,
});

const DAYS = 24 * 60 * 60 * 1000;

function getEaseBucket(ease: number): Grade {
  if (ease < 2.2) {
    return Grade.HARD;
  }

  if (ease > 2.7) {
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

export async function setGrade(quiz: Quiz, grade: Grade, now = Date.now()) {
  const fsrsCard = {
    D: quiz.difficulty,
    S: quiz.stability,
  };
  const past = (now - quiz.lastReview) / DAYS;
  const result = FSRS.gradeCard(fsrsCard, past, grade);
  const nextQuiz = {
    ...quiz,
    difficulty: result.D,
    stability: result.S,
    firstReview: quiz.firstReview || now,
    lastReview: now,
    nextReview: now + result.I * DAYS,
    lapses: grade === Grade.AGAIN ? quiz.lapses + 1 : quiz.lapses,
    repetitions: quiz.repetitions + 1,
  };
  console.log(`=== Will review Quiz ${quiz.id} again in ${result.I} days ===`);
  await prismaClient.quiz.update({
    where: { id: quiz.id },
    data: nextQuiz,
  });
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
          const schedulingGuess = FSRS.gradeCard(card0, card0.I, grade);
          const nextReview = fuzzDate(new Date(card.nextReviewAt));
          console.log(`${cardId} due in ${timeUntil(nextReview)}`);
          await prismaClient.quiz.create({
            data: {
              cardId,
              quizType,
              stability: schedulingGuess.S,
              difficulty: schedulingGuess.D,
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
