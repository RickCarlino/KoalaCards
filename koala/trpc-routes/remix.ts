import { z } from "zod";
import { procedure } from "../trpc-procedure";
import { getUserSettings } from "../auth-helpers";
import { openai } from "../openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { prismaClient } from "../prisma-client";
import { RemixTypePrompts, RemixTypes } from "../remix-types";

const zodRemix = z.object({
  result: z.array(
    z.object({
      exampleSentence: z.string(),
      englishTranslation: z.string(),
    }),
  ),
});

const LANG_SPECIFIC_PROMPT: Record<string, string | undefined> = {
  KO: "You will be severly punished for using 'dictionary form' verbs or the pronouns 그녀, 그, 당신.",
};

async function askGPT(
  type: RemixTypes,
  langCode: string,
  term: string,
  _definition: string,
) {
  const model = "gpt-4o";
  const langSpecific = LANG_SPECIFIC_PROMPT[langCode.toUpperCase()] || "";
  const content = [
    "You are a language teacher.",
    "You help the student learn the language by creating 'remix' sentences using the input above.",
    "Your student is a native English speaker.",
    "Create a few short, grammatically correct sentences that help the student understand the term.",
    langSpecific,
    `INPUT: ${term}`,
    `YOUR TASK: ${RemixTypePrompts[type]}`,
  ].join("\n");
  const resp = await openai.beta.chat.completions.parse({
    messages: [
      {
        role: "assistant",
        content,
      },
    ],
    model,
    max_tokens: 400,
    temperature: 0.7,
    response_format: zodResponseFormat(zodRemix, "remix_resp"),
  });
  const grade_response = resp.choices[0];
  const unsorted = grade_response.message.parsed?.result || [];
  const result = unsorted
    .sort((a, b) => a.exampleSentence.length - b.exampleSentence.length)
    .slice(0, 7)
    .map((r) => {
      return {
        term: r.exampleSentence,
        definition: r.englishTranslation,
      };
    });

  console.log(content);
  return result;
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
