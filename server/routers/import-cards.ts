import { z } from "zod";
import { procedure } from "../trpc";
import { OLD_BACKUP_SCHEMA } from "@/pages/cards";
import { Grade, createDeck } from "femto-fsrs";
import { prismaClient } from "../prisma-client";
import { getUserSettings } from "../auth-helpers";
import { timeUntil } from "@/utils/srs";

const DECK = createDeck();

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
  const days = 24 * 60 * 60 * 1000;
  return new Date(date.getTime() + randomOffset * days).getTime();
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
          const card0 = DECK.newCard(grade);
          const schedulingGuess = DECK.gradeCard(card0, card0.I, grade);
          const nextReview = fuzzDate(new Date(card.nextReviewAt));
          console.log(`${cardId} due in ${timeUntil(nextReview)}`);
          await prismaClient.quiz.create({
            data: {
              cardId,
              quizType,
              stability: schedulingGuess.S,
              retrievability: schedulingGuess.D,
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
