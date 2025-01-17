import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getUserSettings } from "../auth-helpers";
import { openai } from "../openai";
import { prismaClient } from "../prisma-client";
import { RemixTypePrompts, RemixTypes } from "../remix-types";
import { procedure } from "../trpc-procedure";
import { isApprovedUser } from "../is-approved-user";

interface RemixParams {
  type: RemixTypes;
  langCode: string;
  term: string;
  definition: string;
  model: keyof typeof MODELS;
}

interface Remix {
  term: string;
  definition: string;
}

const LANG_SPECIFIC_PROMPT: Record<string, string> = {
  KO: "You will be severely punished for using 'dictionary form' or 'plain form' verbs or the pronouns 그녀, 그, 당신.",
};

const MODELS: Record<"good" | "fast" | "cheap" | "premium", string> = {
  premium: "o1-preview", // $10.00 + $10.00 = $20.00
  good: "o1-mini", // $12.00 + $3.00 = $15.00
  fast: "gpt-4o", // $2.50 + $10 = $12.50
  cheap: "gpt-4o-mini", // $0.150 + $0.600 = $0.750
};

const JSON_PARSE_PROMPT = [
  "You are a JSON parser.",
  "You must convert the data into valid JSON that matches the following schema:",
  "Schema: { result: [ { exampleSentence: string, englishTranslation: string } ] }",
].join(" ");

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
  return [
    "You are a language teacher.",
    "You help the student learn a language by creating 'remix' sentences using the input above.",
    "Your student is a native English speaker.",
    "Create a few short, grammatically correct sentences that help the student understand the term.",
    langSpecific,
    `INPUT: ${term}`,
    `YOUR TASK: ${RemixTypePrompts[type]}`,
  ].join("\n");
};

const fetchOpenAIResponse = async (
  model: string,
  messages: any[],
): Promise<string> => {
  const response = await openai.chat.completions.create({
    model,
    messages,
  });

  const choice = response.choices[0];
  if (!choice || choice.finish_reason !== "stop") {
    throw new Error(`Bad response from ${model}: ${JSON.stringify(choice)}`);
  }

  return choice.message?.content || "";
};

const parseJSONWithOpenAI = async (
  rawText: string,
): Promise<{
  result: { exampleSentence: string; englishTranslation: string }[];
}> => {
  const response = await openai.beta.chat.completions.parse({
    model: MODELS.cheap,
    messages: [
      { role: "system", content: JSON_PARSE_PROMPT },
      { role: "user", content: rawText },
    ],
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
  const { type, langCode, term, model } = input;
  const prompt = buildRemixPrompt(type, langCode, term);

  const rawText = await fetchOpenAIResponse(MODELS[model], [
    { role: "user", content: prompt },
  ]);

  const parsedData = await parseJSONWithOpenAI(rawText);

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

    // Thanks for the free tokens, OpenAI.
    // Check if date is prior to Feb 28 2025:
    const freeTokens = new Date() < new Date(2025, 1, 28);
    return generateRemixes({
      type: input.type as RemixTypes,
      langCode: card.langCode,
      term: card.term,
      definition: card.definition,
      model: freeTokens || isApprovedUser(card.userId) ? "premium" : "good",
    });
  });
