import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc";
import { getUserSettings } from "../auth-helpers";

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
    const settings = await getUserSettings(ctx.user?.id);
    // Ensure that the user passed the same updatedAt timestamp
    // otherwise invalidate the update since it could be stale
    if (settings.updatedAt.getTime() !== input.updatedAt.getTime()) {
      throw new Error("Update conflict: the data might be stale");
    }

    // Update settings
    const updatedSettings = await prismaClient.userSettings.update({
      where: { id: input.id },
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
