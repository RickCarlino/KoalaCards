import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { openai } from "../openai";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { LangCode } from "../shared-types";
import { getLangName } from "../get-lang-name";

const chat = async (system: string, user?: string): Promise<string> => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: user
      ? [
          { role: "system", content: system },
          { role: "user", content: user },
        ]
      : [{ role: "system", content: system }],
  });

  // Extract the text content from the response
  return response.choices[0]?.message?.content || "";
};

const inputSchema = z.object({
  deckId: z.number(),
  prompt: z.string().min(2),
});

const outputSchema = z.string();

export const generateWritingSample = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

    const deck = await prismaClient.deck.findUnique({
      where: { id: input.deckId, userId },
      select: {
        langCode: true,
      },
    });
    if (!deck) throw new TRPCError({ code: "NOT_FOUND" });
    const language = getLangName(deck.langCode as LangCode);
    return await chat(
      `Provide a sample response to the question. Respond in ${language}.`,
      input.prompt,
    );
  });
