import { shuffle, unique } from "radash";
import { z } from "zod";
import { openai } from "../openai";
import { zodResponseFormat } from "openai/helpers/zod"; // Import the helper
import { prismaClient } from "../prisma-client";
import { LANG_CODES } from "../shared-types";
import { procedure } from "../trpc-procedure";
import { getLangName } from "../get-lang-name";

// Define a simple input schema for now, just the language code
const inputSchema = z.object({
  langCode: LANG_CODES,
  // TODO: Add topic, difficulty level later as per IDEA.md
});

// Zod schema for the expected structured output from OpenAI
const PromptSchema = z.object({
  prompts: z.array(z.string()),
});

// Define the tRPC output schema - still an array of strings
const outputSchema = z.array(z.string());

export const generateWritingPrompts = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error("User not found");
    }

    const { langCode } = input;

    // Get last 1000 quiz IDs, sorted by lastReview (most recent first), unique by cardId
    const cardIDs = (
      await prismaClient.quiz.findMany({
        where: {
          Card: {
            userId,
            langCode,
          },
        },
        orderBy: {
          lastReview: "desc",
        },
        take: 1000,
        select: {
          cardId: true,
        },
      })
    ).map((quiz) => quiz.cardId);
    const inspiration = shuffle(
      await prismaClient.card.findMany({
        where: {
          id: {
            in: shuffle(unique(cardIDs)).slice(0, 10),
          },
        },
        select: {
          term: true,
        },
      }),
    ).map((x) => x.term);

    if (inspiration.length < 10) {
      return ["Please study more vocabulary to generate prompts."];
    }

    // New prompt incorporating inspiration sentences and specific instructions
    const prompt = `
You are an expert language and creative writing instructor. Using a hidden list of inspirational target language sentences (which you can see but the learner cannot), generate five distinct and engaging writing prompts. These prompts should subtly capture the vibes and themes drawn from the hidden sentences without revealing any of their content. Write all prompts in ${getLangName(
      langCode,
    )}.

Ensure that the writing prompts guide the learner to explore, analyze, and creatively respond to themes implied by the hidden examples –
this is not a vocabulary quiz but a creative exercise.

The five writing prompt types to generate are:

Opinion Expression:
Express your opinion on a topic inspired by the themes from the hidden examples. Provide reasons and illustrative details that support your perspective.

Dialog Interpretation:
Imagine a dialog situation influenced by the underlying themes. Read the scenario and answer this guiding question: What is the main conflict or issue, and how can it be resolved?

Question & Answer:
Answer a thought-provoking question that arises from a scenario related to the hidden inspiration. Develop a detailed response considering all aspects of the given situation.

Information Interpretation:
Interpret a piece of informative content reflecting the broader theme. Summarize the key ideas and explain their significance in a clear, creative manner.

Please craft each of these prompts so they inspire creative thinking and clear, thoughtful responses, drawing on the hidden thematic cues without disclosing them to the learner.

`;

    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: zodResponseFormat(PromptSchema, "generated_prompts"),
    });

    const parsedResponse = completion.choices[0]?.message?.parsed;

    if (!parsedResponse) {
      console.error(
        "Invalid or missing parsed response from OpenAI:",
        completion.choices[0]?.message,
      );
      throw new Error("Failed to get structured prompts from OpenAI");
    }

    // Return the array of prompts from the parsed structure
    return parsedResponse.prompts;
  });
