import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";
import { openai } from "../openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { prismaClient } from "../prisma-client";

const zodRemix = z.object({
  result: z.array(
    z.object({
      term: z.string(),
      definition: z.string(),
    }),
  ),
});

async function askGPT(term: string, _definition: string) {
  const model = "gpt-4o-2024-08-06";
  const resp = await openai.beta.chat.completions.parse({
    messages: [
      {
        role: "user",
        content: `${term}`,
      },
      {
        role: "assistant",
        content: [
          "The user is a native english speaker learning a foriegn language.",
          "The student wants to solidify their understanding of vocab and grammar patterns used in the sentence.",
          "You will help them by providing 10 'remixes' of the sentence.",
          "A remix sentence that uses similar vocab or grammar patterns (but not both!) and is slightly different in meaning.",
          "Since this is a language learning app, it is critical that the sentences be grammatically correct.",
          "The sentences also need to be short and realistic.",
          "The focus of a remix is to re-use exact words and grammar structure, not the subject matter of the input sentence.",
        ].join("\n"),
      },
    ],
    model,
    max_tokens: 500,
    temperature: 1,
    response_format: zodResponseFormat(zodRemix, "remix_resp"),
  });
  const grade_response = resp.choices[0];
  const result = grade_response.message.parsed?.result || [];

  return result.sort((a, b) => a.term.length - b.term.length).slice(0, 7);
}
/** The `faucet` route is a mutation that returns a "Hello, world" string
 * and takes an empty object as its only argument. */
export const remix = procedure
  .input(
    z.object({
      cardID: z.number(),
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
    // I will fill this part out, don't worry about it for now.
    // Show it to you so you understand the schema.
    const x = await getUserSettings(ctx.user?.id);
    console.log(x.userId);
    const card = await prismaClient.card.findFirst({
      where: {
        userId: x.userId,
        id: input.cardID,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    if (!card) {
      throw new Error("Card not found");
    }
    return await askGPT(card.term, card.definition);
  });
