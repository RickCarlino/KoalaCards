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
// const MAX_TOKENS = 400;
// const REMIX_TEMP = 0.7;
const CHEAP_MODEL = "gpt-4o-mini";
const EXPENSIVE_MODEL = "o1-mini"; // $12.00 / 1M output tokens
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

function buildRemixPrompt(
  type: RemixTypes,
  langCode: string,
  term: string,
): string {
  const langSpecific = LANG_SPECIFIC_PROMPT[langCode.toUpperCase()] ?? "";
  return [
    "You are a language teacher.",
    `You help the student learn a language by creating 'remix' sentences using the input above.`,
    "Your student is a native English speaker.",
    "Create 5 short, grammatically correct sentences that help the student understand the term.",
    langSpecific,
    `INPUT: ${term}`,
    `YOUR TASK: ${RemixTypePrompts[type]}`,
  ].join("\n");
}

/**
 * 1) Ask GPT-4O1-MINI for raw text (NO JSON mode).
 * 2) Feed that raw text into GPT-4O-MINI, using JSON mode with our REMIX_SCHEMA.
 */
async function askGPT(
  type: RemixTypes,
  langCode: string,
  term: string,
  _definition: string,
) {
  const prompt = buildRemixPrompt(type, langCode, term);
  // --- STEP 1: Get raw text from GPT-4O1-MINI (the reasoning model).
  const rawRemixResponse = await openai.chat.completions.create({
    model: EXPENSIVE_MODEL,
    // max_completion_tokens: MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  // The raw text from GPT-4O1-MINI
  const resp = rawRemixResponse.choices[0];
  if (!resp || resp.finish_reason !== "stop") {
    throw new Error("Bad response from GPT-4o1-mini: " + JSON.stringify(resp));
  }
  const rawText = resp?.message?.content || "";
  console.log(`==== TOKENS:` + rawRemixResponse.usage?.total_tokens);
  console.log(prompt);
  // --- STEP 2: Convert raw text to JSON with GPT-4O-MINI + Zod schema
  const parseResponse = await openai.beta.chat.completions.parse({
    model: CHEAP_MODEL,
    messages: [
      {
        role: "system",
        content: JSON_PARSE_PROMPT,
      },
      {
        role: "user",
        content: rawText,
      },
    ],
    response_format: REMIX_SCHEMA,
  });

  // Extract the parsed JSON array
  const unsorted = parseResponse.choices[0]?.message?.parsed?.result ?? [];

  // Sort and limit the result as before
  const sorted = unsorted.sort(
    (a, b) => a.exampleSentence.length - b.exampleSentence.length,
  );
  const limited = sorted.slice(0, MAX_REMIXES);

  // Return final data in your preferred shape
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

    // Now we do the 2-step GPT approach above
    return askGPT(
      input.type as RemixTypes,
      card.langCode,
      card.term,
      card.definition,
    );
  });
