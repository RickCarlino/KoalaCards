import { prismaClient } from "@/server/prisma-client";
import { z } from "zod";
import { procedure, router } from "../trpc";
import { getNextQuiz, getNextQuizzes } from "./get-next-quizzes";
import { failPhrase, performExam } from "./perform-exam";

export const appRouter = router({
  /** The `faucet` route is a mutation that returns a "Hello, world" string
   * and takes an empty object as its only argument. */
  faucet: procedure
    .input(z.object({}))
    .output(z.object({ message: z.string() }))
    .mutation(async () => {
      return { message: "[]" };
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
          term: z.string(),
          definition: z.string(),
        }),
      ),
    )
    .mutation(async ({ input, ctx }) => {
      const results: { term: string; definition: string }[] = [];
      for (const { term: korean, definition: english } of input.input) {
        const userId = ctx.user?.id;
        if (userId) {
          const alreadyExists = await prismaClient.card.findFirst({
            where: {
              userId,
              term: korean,
            },
          });
          if (!alreadyExists) {
            await prismaClient.card.create({
              data: {
                userId,
                term: korean,
                definition: english,
              },
            });
            results.push({
              term: korean,
              definition: english,
            });
          } else {
            const ERR = "(Duplicate) ";
            results.push({
              term: ERR + korean,
              definition: ERR + english,
            });
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
          term: z.string(),
          definition: z.string(),
        }),
      ),
    )
    .query(async ({ ctx }) => {
      return await prismaClient.card.findMany({
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
        definition: z.optional(z.string()),
        term: z.optional(z.string()),
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
          flagged: false,
        },
      });

      if (!card) {
        throw new Error("Card not found");
      }

      await prismaClient.card.update({
        where: { id: card.id },
        data: {
          term: input.term ?? card.term,
          definition: input.definition ?? card.definition,
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
        definition: z.string(),
        term: z.string(),
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
      return {
        id: card.id,
        definition: card.definition,
        term: card.term,
        flagged: card.flagged,
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
  getNextQuizzes,
  getNextQuiz,
  failPhrase,
  performExam,
});

export type AppRouter = typeof appRouter;
