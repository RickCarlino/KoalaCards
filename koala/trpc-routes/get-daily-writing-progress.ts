import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { prismaClient } from "../prisma-client";
import { TRPCError } from "@trpc/server";

// Input schema is empty as userId comes from context
const inputSchema = z.object({});

// Output schema for writing progress and goal
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
      throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
    }

    // Calculate the start of the current day in UTC
    const now = new Date();
    const startOfTodayUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    try {
      // Get the user's daily writing goal from settings
      const userSettings = await prismaClient.userSettings.findUnique({
        where: { userId },
        select: { dailyWritingGoal: true },
      });

      // Default to 300 if not found
      const goal = userSettings?.dailyWritingGoal ?? 300;

      // Get the user's progress for today
      const result = await prismaClient.writingSubmission.aggregate({
        _sum: {
          // Summing correctionCharacterCount as per WRITING.md
          correctionCharacterCount: true,
        },
        where: {
          userId: userId,
          createdAt: {
            gte: startOfTodayUTC, // Greater than or equal to the start of today UTC
          },
        },
      });

      // Calculate progress and percentage
      const progress = result._sum.correctionCharacterCount ?? 0;
      const percentage = Math.min(Math.round((progress / goal) * 100), 100);

      return { progress, goal, percentage };
    } catch (error) {
      console.error("Failed to get daily writing progress:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve daily writing progress.",
        cause: error,
      });
    }
  });
