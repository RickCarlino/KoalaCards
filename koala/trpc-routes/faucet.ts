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

    const random = shuffle([...yes, ...no]).slice(0, 3);

    const results = await Promise.all(
      random.map(async (card) => {
        const output = await grammarCorrectionNext({
          userID: userdId,
          card: {
            term: card.term,
            definition: card.definition,
            langCode: card.langCode,
          },
          userInput: card.userInput,
        });
        return {
          id: card.id,
          term: card.term,
          definition: card.definition,
          result: output.result,
          userMessage: output.userMessage,
        };
      }),
    );
    return results.filter((x) => x.result === "fail");
  });
