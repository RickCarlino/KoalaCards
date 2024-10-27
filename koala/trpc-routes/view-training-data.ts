// import { errorReport } from "@/koala/error-report";
import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { isApprovedUser } from "../is-approved-user";

export const viewTrainingData = procedure
  .input(z.object({}))
  .output(
    z.array(
      z.object({
        id: z.number(),
        createdAt: z.date(),
        englishTranslation: z.string(),
        explanation: z.string(),
        definition: z.string(),
        userInput: z.string(),
        quizType: z.string(),
        langCode: z.string(),
        yesNo: z.string(),
        term: z.string(),
      }),
    ),
  )
  .query(async ({ ctx }) => {
    const userId = (await getUserSettings(ctx.user?.id)).user.id;
    if (!isApprovedUser(userId)) {
      // return errorReport("Only admins can view training data");
    }
    // Return the last 100 training data entries
    const data = await prismaClient.trainingData.findMany({
      where: {
        explanation: process.env.GPT_MODEL || "gpt-4o",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 500,
    });

    return data.map((trainingData) => {
      return {
        id: trainingData.id,
        createdAt: trainingData.createdAt,
        englishTranslation: trainingData.englishTranslation,
        explanation: trainingData.explanation,
        definition: trainingData.definition,
        userInput: trainingData.userInput,
        quizType: trainingData.quizType,
        langCode: trainingData.langCode,
        yesNo: trainingData.yesNo,
        term: trainingData.term,
      };
    });
  });
