import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";
import { openai } from "../openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { prismaClient } from "../prisma-client";
import { draw } from "radash";
import { RemixTypePrompts, RemixTypes } from "../remix-types";

const zodRemix = z.object({
  result: z.array(
    z.object({
      term: z.string(),
      definition: z.string(),
    }),
  ),
});

const LANGUAGE_SPECIFIC_ADDITIONS: Record<string, string | undefined> = {
  KO: "Avoid using 'dictionary form' and 'plain form' verbs. Don't use the pronouns 그녀, 그, 당신.",
};

async function askGPT(
  type: RemixTypes,
  langCode: string,
  term: string,
  _definition: string,
) {
  const model = "gpt-4o-2024-08-06";
  const temperature = draw([0.65, 0.7/*, 0.75*/]) || 1;
  const frequency_penalty = draw([0.4, 0.45, 0.55]) || 1;
  const presence_penalty = draw([0.7, 0.75, 0.8]) || 1;
  const langSpecific = LANGUAGE_SPECIFIC_ADDITIONS[langCode] || "";
  // BAD:
  // None yet.
  // GOOD:
  // [ 0.65, 0.4, 0.75 ]
  // [ 0.65, 0.45, 0.7 ]
  // [ 0.7, 0.45, 0.75 ]
  // [ 0.75, 0.55, 0.7 ]
  console.log({
    params: [temperature, frequency_penalty, presence_penalty],
    val: RemixTypePrompts[type],
  });
  const resp = await openai.beta.chat.completions.parse({
    messages: [
      {
        role: "user",
        content: `${term}`,
      },
      {
        role: "user",
        content: RemixTypePrompts[type],
      },
      {
        role: "assistant",
        content: [
          "You are a language teacher.",
          "Your student is a native English speaker.",
          "You help the student learn the language by creating a 'remix' of the input sentences.",
          "The 'definition' attribute is an English translation of the target sentence.",
          "Sound natural like a native speaker, producing grammatically correct and realistic sentences.",
          "Definition = English. Term = Target language.",
          langSpecific,
        ].join("\n"),
      },
    ],
    model,
    max_tokens: 500,
    temperature,
    frequency_penalty, // Encourages variety
    presence_penalty, // Reduces overuse of key words
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
      type: z.number(),
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

    return await askGPT(
      input.type as RemixTypes,
      card.langCode,
      card.term,
      card.definition,
    );
  });
