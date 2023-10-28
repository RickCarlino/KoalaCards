import { z } from "zod";
import { procedure } from "../trpc";
import getLessons from "@/utils/fetch-lesson";
import { prismaClient } from "../prisma-client";

const Quiz = z.object({
  id: z.number(),
  definition: z.string(),
  term: z.string(),
  repetitions: z.number(),
  lapses: z.number(),
  audio: z.object({
    dictation: z.string(),
    listening: z.string(),
    speaking: z.string(),
  }),
});

const QuizList = z.object({
  quizzes: z.array(Quiz),
  totalCards: z.number(),
  quizzesDue: z.number(),
  newCards: z.number(),
});

async function getLessonMeta(userId: string) {
  const totalCards = await prismaClient.card.count({
    where: {
      flagged: false,
      userId,
      OR: [{ repetitions: { gt: 0 } }, { lapses: { gt: 0 } }],
    },
  });
  // SELECT COUNT()
  // FROM Card
  // WHERE nextReviewAt < Date.now()
  // AND flagged = false
  // AND userId = ?;
  // AND repetitions <> 0
  // ORDER BY repetitions DESC, nextReviewAt DESC;
  const quizzesDue = await prismaClient.card.count({
    where: {
      flagged: false,
      userId,
      nextReviewAt: { lte: Date.now() },
      OR: [{ repetitions: { gt: 0 } }, { lapses: { gt: 0 } }],
    },
  });
  // SELECT COUNT()
  // FROM Card
  // WHERE repetitions = 0
  // AND flagged = false
  // AND userId = ?;
  const newCards = await prismaClient.card.count({
    where: {
      flagged: false,
      userId,
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
  .input(z.object({}))
  .output(QuizList)
  .query(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error("User not found");
    }
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
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error("User not found");
    }

    const take = input.notIn.length < 3 ? 3 : 1;
    const quizzes = await getLessons({
      userId,
      take,
      notIn: input.notIn,
    });
    return {
      ...(await getLessonMeta(userId)),
      quizzes,
    };
  });
