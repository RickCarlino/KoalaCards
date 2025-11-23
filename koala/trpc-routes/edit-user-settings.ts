import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";
import { errorReport } from "@/koala/error-report";

export const editUserSettings = procedure
  .input(
    z.object({
      id: z.optional(z.number()),
      playbackSpeed: z.number().min(0.5).max(2),
      cardsPerDayMax: z.number().min(1),
      playbackPercentage: z.number().min(0).max(1),
      dailyWritingGoal: z.number().int().min(1).optional(),
      writingFirst: z.boolean().optional(),
      performCorrectiveReviews: z.boolean().optional(),
      updatedAt: z.date(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const settings = await getUserSettings(ctx.user?.id);
    if (settings.updatedAt.getTime() !== input.updatedAt.getTime()) {
      return errorReport("Update conflict: the data might be stale");
    }

    const updatedSettings = await prismaClient.userSettings.update({
      where: {
        id: input.id,
        userId: ctx.user?.id,
      },
      data: {
        ...(input.playbackSpeed !== undefined && {
          playbackSpeed: input.playbackSpeed,
        }),
        ...(input.cardsPerDayMax !== undefined && {
          cardsPerDayMax: input.cardsPerDayMax,
        }),
        ...(input.playbackPercentage !== undefined && {
          playbackPercentage: input.playbackPercentage,
        }),
        ...(input.dailyWritingGoal !== undefined && {
          dailyWritingGoal: input.dailyWritingGoal,
        }),
        ...(input.writingFirst !== undefined && {
          writingFirst: input.writingFirst,
        }),
        ...(input.performCorrectiveReviews !== undefined && {
          performCorrectiveReviews: input.performCorrectiveReviews,
        }),
        updatedAt: new Date(),
      },
    });

    return updatedSettings;
  });
