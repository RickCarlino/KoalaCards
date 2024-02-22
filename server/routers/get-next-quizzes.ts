import { z } from "zod";
import { procedure } from "../trpc";
import getLessons from "@/utils/fetch-lesson";
import { getUserSettings } from "../auth-helpers";
import { prismaClient } from "../prisma-client";

export const Quiz = z.object({
  quizId: z.number(),
  cardId: z.number(),
  definition: z.string(),
  term: z.string(),
  repetitions: z.number(),
  lapses: z.number(),
  lessonType: z.union([z.literal("listening"), z.literal("speaking")]),
  audio: z.string(),
});

const QuizList = z.object({
  quizzes: z.array(Quiz),
  totalCards: z.number(),
  quizzesDue: z.number(),
  newCards: z.number(),
});

export async function getLessonMeta(userId: string) {
  const currentDate = new Date().getTime(); // Current time in milliseconds

  const quizzesDue = await prismaClient.quiz.count({
    where: {
      Card: {
        userId: userId,
        flagged: false,
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
  const newCards = await prismaClient.card.count({
    where: {
      userId: userId,
      flagged: false,
      Quiz: {
        none: {},
      },
    },
  });
  return {
    totalCards,
    quizzesDue,
    newCards,
  };
}

export const getNextQuizzes = procedure
  .input(z.object({}))
  .output(QuizList)
  .query(async ({ ctx }) => {
    const userId = (await getUserSettings(ctx.user?.id)).user.id;
    return {
      ...(await getLessonMeta(userId)),
      quizzes: await getLessons({ userId }),
    };
  });

export const getNextQuiz = procedure
  .input(
    z.object({
      notIn: z.array(z.number()),
    }),
  )
  .output(QuizList)
  .mutation(async ({ ctx }) => {
    const userId = (await getUserSettings(ctx.user?.id)).user.id;
    return {
      quizzes: [],
      ...(await getLessonMeta(userId)),
    };
  });
