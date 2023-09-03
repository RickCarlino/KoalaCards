import { prismaClient } from "@/server/prisma-client";
import { ingestOne, ingestPhrases } from "@/utils/ingest-phrases";
import { phraseFromUserInput, randomNew } from "@/utils/random-new";
import { z } from "zod";
import { procedure, router } from "../trpc";
import { getNextQuizzes } from "./get-next-quizzes";
import { failPhrase, performExam } from "./perform-exam";

prismaClient.phrase.count().then((any) => {
  if (!any) {
    console.log("New database detected...");
    ingestPhrases();
  }
});

export const appRouter = router({
  /** The `faucet` route is a mutation that returns a "Hello, world" string
   * and takes an empty object as its only argument. */
  faucet: procedure
    .input(z.object({}))
    .output(z.object({ message: z.string() }))
    .mutation(async () => {
      const card = await randomNew();
      return { message: JSON.stringify(card, null, 2) };
    }),
  importPhrases: procedure
    .input(
      z.object({
        input: z.array(
          z.object({
            term: z.string(),
            definition: z.string(),
          }),
        ),
      }),
    )
    .output(
      z.array(
        z.object({
          ko: z.string(),
          en: z.string(),
          input: z.string(),
        }),
      ),
    )
    .mutation(async ({ input, ctx }) => {
      const results: { ko: string; en: string; input: string }[] = [];
      for (const { term, definition } of input.input) {
        const candidates = await phraseFromUserInput(term, definition);
        const userId = ctx.user?.id;
        for (const result of candidates) {
          if (result && userId) {
            const phrase = await ingestOne(result.ko, result.en, term);
            if (phrase) {
              const alreadyExists = await prismaClient.card.findFirst({
                where: { userId, phraseId: phrase.id },
              });
              if (!alreadyExists) {
                await prismaClient.card.create({
                  data: {
                    userId,
                    phraseId: phrase.id,
                  },
                });
              } else {
                console.log("Duplicate phrase: ");
                console.log(result);
              }
              results.push({
                ko: result.ko,
                en: result.en,
                input: term,
              });
            }
          }
        }
      }
      return results;
    }),
  getAllPhrases: procedure
    .input(z.object({}))
    .output(
      z.array(
        z.object({
          id: z.number(),
          flagged: z.boolean(),
          phrase: z.object({
            id: z.number(),
            term: z.string(),
            definition: z.string(),
          }),
        }),
      ),
    )
    .query(async ({ ctx }) => {
      return await prismaClient.card.findMany({
        include: { phrase: true },
        where: { userId: ctx.user?.id || "000" },
        orderBy: { nextReviewAt: "asc" },
      });
    }),
  deleteCard: procedure
    .input(
      z.object({
        id: z.optional(z.number()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new Error("User not found");
      }

      const card = await prismaClient.card.findFirst({
        where: {
          id: input.id,
          userId,
        },
      });

      if (!card) {
        throw new Error("Card not found");
      }

      await prismaClient.card.delete({
        where: { id: card.id },
      });
    }),
  editCard: procedure
    .input(
      z.object({
        id: z.optional(z.number()),
        en: z.optional(z.string()),
        ko: z.optional(z.string()),
        flagged: z.optional(z.boolean()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new Error("User not found");
      }

      const card = await prismaClient.card.findFirst({
        where: {
          id: input.id,
          userId,
        },
      });

      if (!card) {
        throw new Error("Card not found");
      }

      await prismaClient.card.update({
        where: { id: card.id },
        data: {
          flagged: input.flagged ?? false,
        },
      });
    }),
  getOneCard: procedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .output(
      z.object({
        id: z.number(),
        en: z.string(),
        ko: z.string(),
        flagged: z.boolean(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const card = await prismaClient.card.findFirst({
        where: {
          id: input.id,
          userId: ctx.user?.id || "000",
        },
      });
      if (!card) {
        throw new Error("Card not found");
      }
      const phrase = await prismaClient.phrase.findFirst({
        where: { id: card.phraseId },
      });
      if (!phrase) {
        throw new Error("Phrase not found");
      }
      return {
        ...card,
        en: phrase.definition,
        ko: phrase.term,
      };
    }),
  flagPhrase: procedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const card = await prismaClient.card.findFirst({
        where: {
          id: input.id,
          userId: ctx.user?.id || "0",
        },
      });
      if (card) {
        await prismaClient.card.update({
          where: { id: card.id },
          data: {
            flagged: true,
          },
        });
      }
    }),
  getNextQuizzes: getNextQuizzes,
  failPhrase,
  performExam,
});

// export type definition of API
export type AppRouter = typeof appRouter;
