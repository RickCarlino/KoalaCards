import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { prismaClient } from "../prisma-client";
import { TRPCError } from "@trpc/server";

const inputSchema = z.object({});

const outputSchema = z.object({
  progress: z.number(),
  goal: z.number(),
  percentage: z.number(),
});

export const getDailyWritingProgress = procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not found",
      });
    }

    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const userSettings = await prismaClient.userSettings.findUnique({
      where: { userId },
      select: { dailyWritingGoal: true },
    });

    const goal = userSettings?.dailyWritingGoal ?? 300;

    const result = await prismaClient.writingSubmission.aggregate({
      _sum: {
        correctionCharacterCount: true,
      },
      where: {
        userId: userId,
        createdAt: {
          gte: last24Hours,
        },
      },
    });

    const progress = result._sum.correctionCharacterCount ?? 0;
    const percentage = Math.min(Math.round((progress / goal) * 100), 100);

    return { progress, goal, percentage };
  });
