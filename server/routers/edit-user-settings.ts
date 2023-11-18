import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc";

export const editUserSettings = procedure
  .input(
    z.object({
      id: z.optional(z.number()),
      listeningPercentage: z.number().min(0).max(1),
      playbackSpeed: z.number().min(0.5).max(2),
      cardsPerDayMax: z.number().min(1),
      playbackPercentage: z.number().min(0).max(1),
      updatedAt: z.date(), // Assuming you pass this from the frontend
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;

    if (!userId) {
      throw new Error("User not found");
    }

    const settings = await prismaClient.userSettings.findFirst({
      where: {
        userId: userId,
        id: input.id,
      },
    });

    if (!settings) {
      // Create new settings object for current user
      const newSettings = await prismaClient.userSettings.create({
        data: {
          ...input,
          userId: userId,
        },
      });
      return newSettings;
    }

    // Ensure that the user passed the same updatedAt timestamp
    // otherwise invalidate the update since it could be stale
    if (settings.updatedAt.getTime() !== input.updatedAt.getTime()) {
      throw new Error("Update conflict: the data might be stale");
    }

    // Update settings
    const updatedSettings = await prismaClient.userSettings.update({
      where: {
        id: input.id,
      },
      data: {
        listeningPercentage: input.listeningPercentage,
        playbackSpeed: input.playbackSpeed,
        cardsPerDayMax: input.cardsPerDayMax,
        playbackPercentage: input.playbackPercentage,
        updatedAt: new Date(), // Update the updatedAt field to current time
      },
    });

    return updatedSettings;
  });
