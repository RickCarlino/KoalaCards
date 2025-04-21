import { shuffle } from "radash";
import { z } from "zod";
import { getLangName } from "../get-lang-name";
import { openai } from "../openai";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { TRPCError } from "@trpc/server";

const inputSchema = z.object({ deckId: z.number() }); // Changed input to deckId
const outputSchema = z.array(z.string());

export const generateWritingPrompts = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
    }

    const { deckId } = input;

    // Fetch the deck to verify ownership and get langCode
    const deck = await prismaClient.deck.findUnique({
      where: { id: deckId, userId },
    });

    if (!deck) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Deck not found or user does not have access.",
      });
    }
    const { langCode } = deck;

    // Fetch inspiration terms specifically from this deck
    const cardsInDeck = await prismaClient.card.findMany({
      where: { userId, deckId },
      select: { term: true },
      take: 100, // Limit the number of cards fetched for performance
    });

    // Use terms from the specific deck as inspiration, declare before the check
    const inspirations = shuffle(cardsInDeck.map((c) => c.term));

    if (inspirations.length < 7) {
      // Need at least 7 cards to pick from for the 7 prompt templates
      return [
        `Please add at least 7 cards to the deck "${deck.name}" to generate diverse writing prompts.`,
        "Alternatively, write about a topic of your choice.",
        "You can start by describing your day.",
      ];
    }

    // Slice inspirations *after* the length check
    const slicedInspirations = inspirations.slice(0, 7);

    const promptTemplates = [
      {
        key: "personalNarrative",
        description:
          "Personal Narrative: Draw on the theme hinted by the hidden sentence.",
        secretIndex: 0,
      },
      {
        key: "hypotheticalRolePlay",
        description:
          "Hypothetical Scenario (Role-Play): Present a real-world scenario and ask the learner to act a role, using language practically.",
        secretIndex: 1,
      },
      {
        key: "opinionArgument",
        description:
          "Opinion / Argument: Invite the learner to give and support their viewpoint on a topic inspired by the hidden sentence.",
        secretIndex: 2,
      },
      {
        key: "descriptive",
        description:
          "Descriptive: Ask the learner to vividly describe a scene or object suggested by the hidden sentence.",
        secretIndex: 3,
      },
      {
        key: "comparativeEvaluative",
        description:
          "Comparative / Evaluative: Have the learner compare two ideas or experiences implied by the hidden sentence.",
        secretIndex: 4,
      },
      {
        key: "reflectiveMetacognitive",
        description:
          "Reflective / Metacognitive: Encourage the learner to reflect on their own beliefs or habits suggested by the hidden sentence.",
        secretIndex: 5,
      },
      {
        key: "proceduralHowTo",
        description:
          "Procedural / How-to: Ask the learner to explain a process or give advice based on the hidden sentence.",
        secretIndex: 6,
      },
    ];

    // Randomly pick three different prompt types
    const selectedTemplates = shuffle(promptTemplates).slice(0, 3);

    // Build the system prompt for OpenAI
    let systemPrompt = `You are a creative writing instructor. Using three hidden example sentences in ${getLangName(
      langCode,
    )}, generate three distinct writing prompts.

- Do NOT reveal the example sentences.
- Keep prompts fresh, non-cliché, and engaging.`;

    // Use the sliced inspirations for the prompt generation
    selectedTemplates.forEach((tpl, idx) => {
      systemPrompt += `

${idx + 1}. ${tpl.description}
   SECRET: ${slicedInspirations[tpl.secretIndex]}`;
    });

    systemPrompt += `

Write each prompt directly in ${getLangName(
      langCode,
    )}, without titles, labels, or numbering. Use natural phrasing suited to a language learner.`;

    // Call OpenAI
    const aiResponse = await openai.beta.chat.completions.parse({
      model: "o4-mini",
      reasoning_effort: "low",
      messages: [{ role: "system", content: systemPrompt }],
    });

    console.log(systemPrompt);
    // Split the AI's output into individual prompts
    const raw = aiResponse.choices[0].message.content || "";
    let prompts = raw
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter((line) => line);

    // Ensure we return exactly 3 prompts if possible, handle edge cases
    // Use the original inspirations array for fallback, checking its length
    if (prompts.length === 0 && inspirations.length >= 3) {
      // Fallback if AI fails but we have at least 3 inspirations
      prompts = [
        `Describe something related to: ${inspirations[0]}`,
        `What is your opinion on: ${inspirations[1]}?`,
        `Imagine a situation involving: ${inspirations[2]}`,
      ];
    } else if (prompts.length === 0 && inspirations.length > 0) {
      // Fallback if AI fails and we have < 3 inspirations
      prompts = [`Describe something related to: ${inspirations[0]}`];
    } else if (prompts.length > 3) {
      prompts = prompts.slice(0, 3); // Take the first 3 if more are returned
    }
    // If fewer than 3 are returned by AI (and not zero), we return what we got.

    return prompts;
  });
