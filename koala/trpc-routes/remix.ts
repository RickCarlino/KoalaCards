import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { openai } from "../openai";
import { prismaClient } from "../prisma-client";
import { RemixTypePrompts, RemixTypes } from "../remix-types";
import { procedure } from "../trpc-procedure";

interface RemixParams {
  type: RemixTypes;
  langCode: string;
  term: string;
  definition: string;
}

interface Remix {
  term: string;
  definition: string;
}

const LANG_SPECIFIC_PROMPT: Record<string, string> = {
  KO: "You will be severely punished for using 'dictionary form' or 'plain form' verbs or the pronouns 그녀, 그, 당신.",
};

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

const buildRemixPrompt = (
  type: RemixTypes,
  langCode: string,
  term: string,
): string => {
  const langSpecific = LANG_SPECIFIC_PROMPT[langCode.toUpperCase()] || "";
  const out = [
    "You are a language teacher.",
    "You help the student learn a language by creating 'remix' sentences using the input below.",
    "Your student is a native English speaker.",
    "Create a few short, grammatically correct sentences that help the student understand the term.",
    langSpecific,
    `INPUT: ${term}`,
    `YOUR TASK: ${RemixTypePrompts[type]}`,
  ].join("\n");
  return out;
};

const fetchOpenAIResponse = async (
  model: string,
  messages: any[],
): Promise<{
  result: { exampleSentence: string; englishTranslation: string }[];
}> => {
  const response = await openai.beta.chat.completions.parse({
    model,
    messages,
    reasoning_effort: "low",
    response_format: REMIX_SCHEMA,
  });

  return response.choices[0]?.message?.parsed || { result: [] };
};

const processRemixes = (parsedData: {
  result: { exampleSentence: string; englishTranslation: string }[];
}): { term: string; definition: string }[] => {
  return parsedData.result
    .sort((a, b) => a.exampleSentence.length - b.exampleSentence.length)
    .slice(0, MAX_REMIXES)
    .map(({ exampleSentence, englishTranslation }) => ({
      term: exampleSentence,
      definition: englishTranslation,
    }));
};

// Refactored generateRemixes function
const generateRemixes = async (input: RemixParams): Promise<Remix[]> => {
  const { type, langCode, term } = input;
  const prompt = buildRemixPrompt(type, langCode, term);

  const parsedData = await fetchOpenAIResponse("o3-mini", [
    { role: "user", content: prompt },
  ]);

  return processRemixes(parsedData);
};

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

    return generateRemixes({
      type: input.type as RemixTypes,
      langCode: card.langCode,
      term: card.term,
      definition: card.definition,
    });
  });
