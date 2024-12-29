import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { openai } from "../openai";
import { prismaClient } from "../prisma-client";
import { RemixTypePrompts, RemixTypes } from "../remix-types";
import { procedure } from "../trpc-procedure";

const LANG_SPECIFIC_PROMPT: Record<string, string | undefined> = {
  KO: "You will be severely punished for using 'dictionary form' verbs or the pronouns 그녀, 그, 당신.",
};
const MAX_TOKENS = 400;
const REMIX_MODEL = "gpt-4o";
const REMIX_TEMP = 0.7;
const MAX_REMIXES = 7;
const REMIX_SCHEMA = zodResponseFormat(
  z.object({
    result: z.array(
      z.object({
        exampleSentence: z.string(),
        englishTranslation: z.string(),
      }),
    ),
  }),
  "remix_resp",
);

function buildRemixPrompt(
  type: RemixTypes,
  langCode: string,
  term: string,
): string {
  const langSpecific = LANG_SPECIFIC_PROMPT[langCode.toUpperCase()] ?? "";
  return [
    "You are a language teacher.",
    "You help the student learn the language by creating 'remix' sentences using the input above.",
    "Your student is a native English speaker.",
    "Create a few short, grammatically correct sentences that help the student understand the term.",
    langSpecific,
    `INPUT: ${term}`,
    `YOUR TASK: ${RemixTypePrompts[type]}`,
  ].join("\n");
}

async function askGPT(
  type: RemixTypes,
  langCode: string,
  term: string,
  _definition: string,
) {
  const content = buildRemixPrompt(type, langCode, term);
  const response = await openai.beta.chat.completions.parse({
    messages: [{ role: "assistant", content }],
    model: REMIX_MODEL,
    max_tokens: MAX_TOKENS,
    temperature: REMIX_TEMP,
    response_format: REMIX_SCHEMA,
  });

  const parsed = response.choices[0]?.message.parsed;
  const unsorted = parsed?.result ?? [];
  const sorted = unsorted.sort(
    (a, b) => a.exampleSentence.length - b.exampleSentence.length,
  );
  const limited = sorted.slice(0, MAX_REMIXES);

  return limited.map((item) => ({
    term: item.exampleSentence,
    definition: item.englishTranslation,
  }));
}

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
    const userSettings = await getUserSettings(ctx.user?.id);
    const card = await prismaClient.card.findFirst({
      where: {
        userId: userSettings.userId,
        id: input.cardID,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!card) {
      throw new Error("Card not found");
    }

    return askGPT(
      input.type as RemixTypes,
      card.langCode,
      card.term,
      card.definition,
    );
  });
