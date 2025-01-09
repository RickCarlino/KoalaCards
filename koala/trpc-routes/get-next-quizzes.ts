import { getLessons } from "@/koala/fetch-lesson";
import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";

export const Quiz = z.object({
  quizId: z.number(),
  cardId: z.number(),
  definition: z.string(),
  term: z.string(),
  repetitions: z.number(),
  lapses: z.number(),
  lessonType: z.union([
    z.literal("listening"),
    z.literal("speaking"),
    z.literal("dictation"),
  ]),
  definitionAudio: z.string(),
  termAudio: z.string(),
  langCode: z.string(),
  lastReview: z.number(),
  imageURL: z.string().optional(),
  stability: z.number(),
  difficulty: z.number(),
});

const QuizList = z.object({
  quizzes: z.array(Quiz),
  totalCards: z.number(),
  quizzesDue: z.number(),
  newCards: z.number(),
});

const QuizInput = z.object({
  take: z.number(),
  deckId: z.number(),
});

export async function getLessonMeta(userId: string) {
  const currentDate = new Date().getTime(); // Current time in milliseconds

  const quizzesDue = await prismaClient.quiz.count({
    where: {
      Card: {
        userId: userId,
        flagged: { not: true },
      },
      nextReview: {
        lt: currentDate,
      },
      firstReview: {
        gt: 0,
      },
    },
  });

  const totalCards = await prismaClient.quiz.count({
    where: {
      Card: {
        userId: userId,
        flagged: false,
      },
    },
  });

  // Cards that have no quiz yet:
  // Count of Quizzes where repetitions and lapses are 0
  // by distinct cardID
  const newCards = await prismaClient.quiz.count({
    where: {
      Card: {
        userId: userId,
        flagged: false,
      },
      repetitions: 0,
      lapses: 0,
    },
  });
  return {
    totalCards,
    quizzesDue,
    newCards,
  };
}

export const getNextQuizzes = procedure
  .input(QuizInput)
  .output(QuizList)
  .mutation(async ({ ctx, input }) => {
    const { user } = await getUserSettings(ctx.user?.id);
    const userId = user.id;
    console.log("### Begin session: " + user.email);
    const quizzes = await Promise.all(
      await getLessons({
        userId,
        deckId: input.deckId,
        now: Date.now(),
        take: input.take,
      }),
    );
    return {
      ...(await getLessonMeta(userId)),
      quizzes,
    };
  });
