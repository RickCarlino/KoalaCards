import { z } from "zod";
import { procedure } from "../trpc-procedure";
import getLessons from "@/koala/fetch-lesson";
import { getUserSettings } from "../auth-helpers";
import { prismaClient } from "../prisma-client";

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
  audio: z.string(),
  langCode: z.string(),
  lastReview: z.number(),
  imageURL: z.string().optional(),
});

const QuizList = z.object({
  quizzes: z.array(Quiz),
  totalCards: z.number(),
  quizzesDue: z.number(),
  newCards: z.number(),
});

const QuizInput = z.object({
  notIn: z.array(z.number()),
  take: z.number(),
});

export async function getLessonMeta(userId: string) {
  const currentDate = new Date().getTime(); // Current time in milliseconds

  const quizzesDue = await prismaClient.quiz.count({
    where: {
      Card: {
        userId: userId,
        flagged: { not: true },
      },
      quizType: {
        in: ["listening", "speaking"],
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
    const userId = (await getUserSettings(ctx.user?.id)).user.id;
    return {
      ...(await getLessonMeta(userId)),
      quizzes: await getLessons({
        userId,
        notIn: input.notIn,
        now: Date.now(),
        take: input.take,
      }),
    };
  });
