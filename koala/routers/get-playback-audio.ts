import { errorReport } from "@/koala/error-report";
import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { generateLessonAudio } from "../fetch-lesson";

export const getPlaybackAudio = procedure
  .input(
    z.object({
      id: z.number(),
    }),
  )
  .output(
    z.object({
      playbackAudio: z.string(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const userId = (await getUserSettings(ctx.user?.id)).user.id;
    const quiz = await prismaClient.quiz.findUnique({
      where: {
        id: input.id,
        Card: {
          userId,
        },
      },
      include: {
        Card: true,
      },
    });
    if (!quiz) {
      return errorReport("Quiz not found");
    }
    const playbackAudio = await generateLessonAudio({
      card: quiz.Card,
      lessonType: "playback",
    });
    return { playbackAudio };
  });
