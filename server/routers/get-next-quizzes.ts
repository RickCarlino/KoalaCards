import { z } from "zod";
import { procedure } from "../trpc";
import getLessons from "@/utils/fetch-lesson";
import { getUserSettings } from "../auth-helpers";

const Quiz = z.object({
  id: z.number(),
  definition: z.string(),
  term: z.string(),
  repetitions: z.number(),
  lapses: z.number(),
  lessonType: z.union([
    z.literal("dictation"),
    z.literal("listening"),
    z.literal("speaking"),
  ]),
  audio: z.string(),
});

const QuizList = z.object({
  quizzes: z.array(Quiz),
  totalCards: z.number(),
  quizzesDue: z.number(),
  newCards: z.number(),
});

export async function getLessonMeta(_userId: string) {
  return {
    totalCards: -1,
    quizzesDue: -1,
    newCards: -1,
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
  .mutation(async (_) => {
    // const userId = (await getUserSettings(ctx.user?.id)).user.id;
    return {
      quizzes: [],
      totalCards: 0,
      quizzesDue: 0,
      newCards: 0,
    };
  });
