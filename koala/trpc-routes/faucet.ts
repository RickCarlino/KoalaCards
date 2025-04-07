import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { procedure } from "../trpc-procedure";
import { prismaClient } from "../prisma-client";
import { shuffle } from "radash";
import { grammarCorrectionNext } from "../grammar";

export const faucet = procedure
  .input(z.object({}))
  .output(
    z.array(
      z.object({
        id: z.number(),
        term: z.string(),
        definition: z.string(),
        result: z.string(),
        userMessage: z.string(),
      }),
    ),
  )
  .mutation(async ({ ctx }) => {
    const us = await getUserSettings(ctx.user?.id);
    const userdId = us?.userId;
    if (!userdId) {
      return [];
    }
    const no = await prismaClient.trainingData.findMany({
      where: {
        yesNo: "no",
        createdAt: {
          gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    const yes = await prismaClient.trainingData.findMany({
      where: {
        yesNo: "yes",
        createdAt: {
          gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    const random = shuffle([...yes, ...no]).slice(0, 30);

    const results = await Promise.all(
      random.map(async (trngData) => {
        const newResult = await grammarCorrectionNext({
          userID: userdId,
          card: {
            term: trngData.term,
            definition: trngData.definition,
            langCode: trngData.langCode,
          },
          userInput: trngData.userInput,
        });
        console.log(newResult);
        const mismatch =
          (newResult.result === "pass" ? "yes" : "no") !== trngData.yesNo;
        return {
          id: trngData.id,
          term: trngData.term,
          definition: trngData.definition,
          result: mismatch ? "fail" : "pass",
          userMessage: `NEW PROMPT: ${
            newResult.userMessage || newResult.result
          }\nOLD PROMPT: ${trngData.explanation}`,
        };
      }),
    );
    return results.filter((x) => x.result === "fail");
  });
