import { z } from "zod";
import { procedure } from "../trpc";
import getLessons from "@/utils/fetch-lesson";
import { prismaClient } from "../prisma-client";

const QuizType = z.union([
  z.literal("dictation"),
  z.literal("listening"),
  z.literal("speaking"),
]);

const Quiz = z.object({
  id: z.number(),
  en: z.string(),
  ko: z.string(),
  repetitions: z.number(),
  audio: z.record(QuizType, z.string()),
});

const QuizList = z.object({
  quizzes: z.array(Quiz),
  totalCards: z.number(),
  quizzesDue: z.number(),
});

type QuizType = z.TypeOf<typeof Quiz>;

async function maybeAddPhraseForUser(userId: string) {
  const count = await prismaClient.card.count({
    where: {
      flagged: false,
      userId,
    },
  });

  if (count < 3) {
    // TODO: Auto-add new cards when user has less than X due in 24 hours.
    const ids = (await prismaClient.$queryRawUnsafe(
      // DO NOT pass in or accept user input here
      `SELECT id FROM Phrase ORDER BY RANDOM() LIMIT 10;`,
    )) as { id: number }[];
    // Select 20 random phrases from phrase table:
    const phrases = await prismaClient.phrase.findMany({
      where: {
        id: { in: ids.map((x) => x.id) },
      },
    });
    // Insert them into the card table:
    for (const phrase of phrases) {
      await prismaClient.card.create({
        data: {
          userId,
          phraseId: phrase.id,
        },
      });
    }
  }
}

export const getNextQuizzes = procedure
  .input(z.object({}))
  .output(QuizList)
  .query(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error("User not found");
    }
    await maybeAddPhraseForUser(userId);
    const totalCards = await prismaClient.card.count({
      where: {
        flagged: false,
        userId,
      },
    });
    // SELECT COUNT()
    // FROM Card
    // WHERE nextReviewAt < Date.now()
    // AND flagged = false
    // AND userId = ?;
    // AND REPETITIONS <> 0
    // ORDER BY repetitions DESC, nextReviewAt DESC;
    const quizzesDue = await prismaClient.card.count({
      where: {
        flagged: false,
        userId,
        nextReviewAt: { lte: Date.now() },
        repetitions: { gt: 0 },
      },
    });
    return {
      quizzes: await getLessons(userId),
      totalCards,
      quizzesDue,
    };
  });
