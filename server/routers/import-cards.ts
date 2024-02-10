import { z } from "zod";
import { procedure } from "../trpc";
import { OLD_BACKUP_SCHEMA } from "@/pages/cards";
import { Grade, createDeck } from "femto-fsrs";
import { prismaClient } from "../prisma-client";
import { getUserSettings } from "../auth-helpers";

const DECK = createDeck();

function getEaseBucket(ease: number): Grade {
  // Define the boundary values for each bucket
  const bucketBoundaries = [1.3, 2.2, 2.50469089182065, 2.7, Infinity];

  // Determine the bucket for the given ease value
  if (ease >= bucketBoundaries[0] && ease < bucketBoundaries[1]) {
    return Grade.AGAIN;
  } else if (ease >= bucketBoundaries[1] && ease < bucketBoundaries[2]) {
    return Grade.HARD;
  } else if (ease >= bucketBoundaries[2] && ease < bucketBoundaries[3]) {
    return Grade.GOOD;
  } else if (ease >= bucketBoundaries[3] && ease <= bucketBoundaries[4]) {
    return Grade.EASY;
  }

  // Default return value in case the input is out of expected range
  throw new Error("Ease value is out of the expected range.");
}

// Take a date and create a new date that is randomly +/- 3 days
// from the original date
function fuzzDate(date: Date) {
  const randomOffset = Math.floor(Math.random() * 7) - 3;
  return new Date(
    date.getTime() + randomOffset * 24 * 60 * 60 * 1000,
  ).getTime();
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
          const fsrsData = DECK.newCard(getEaseBucket(card.ease));
          await prismaClient.quiz.create({
            data: {
              cardId,
              quizType,
              stability: fsrsData.S,
              retrievability: fsrsData.D,
              firstReview: card.firstReview?.getTime() || 0,
              lastReview: card.lastReview?.getTime() || 0,
              nextReview: fuzzDate(card.lastReview || new Date()),
              lapses: card.lapses,
              repetitions: card.repetitions,
            },
          });
          console.log(`${quizType} / ${card.term}`)
        });
        count = count + 1;
      }
    }

    return { count };
  });
