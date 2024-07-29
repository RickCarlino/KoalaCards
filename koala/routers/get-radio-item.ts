import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";
import { prismaClient } from "../prisma-client";
import { generateLessonAudio } from "../speech";

export const getRadioItem = procedure
  .input(
    z.object({
      skip: z.number(),
    }),
  )
  .output(z.object({ audio: z.string().optional() }))
  .mutation(async ({ ctx, input }) => {
    const userId = (await getUserSettings(ctx.user?.id)).user.id;
    const quiz = await prismaClient.quiz.findFirst({
      where: {
        Card: {
          userId,
        },
      },
      include: {
        Card: true,
      },
      orderBy: {
        difficulty: "desc",
      },
      skip: input.skip,
    });
    if (!quiz) {
      return {
        audio: undefined,
      };
    }
    const audio = await generateLessonAudio({
      card: quiz.Card,
      lessonType: "dictation",
    });
    return { audio };
  });
