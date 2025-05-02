import { shuffle } from "radash";
import { z } from "zod";
import { getLangName } from "../get-lang-name";
import { openai } from "../openai";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { TRPCError } from "@trpc/server";

const inputSchema = z.object({ deckId: z.number() }); // Changed input to deckId
const outputSchema = z.array(z.string());

const promptIntro = `
You are a creative writing instructor for language learners.
Using three hidden example sentences only as loose inspiration, generate three distinct, engaging prompts.
- Do NOT reveal, paraphrase, or reference the example sentences directly.
- Treat each example sentence purely as a thematic springboard.
- Focus on natural, contextually appropriate phrasing suited to learners.
- Avoid overly literal or off-beat interpretations of the hidden sentences.
`.trim();

const promptTemplates = [
  "Comparative / Evaluative: Have the learner compare two ideas or experiences implied by the hidden sentence.",
  "Descriptive: Ask the learner to vividly describe a scene or object suggested by the hidden sentence.",
  "Hypothetical Scenario (Role-Play): Present a real-world scenario and ask the learner to act a role, using language practically.",
  "Opinion / Argument: Invite the learner to give and support their viewpoint on a topic inspired by the hidden sentence.",
  "Personal Narrative: Draw on the theme hinted by the hidden sentence.",
  "Procedural / How-to: Ask the learner to explain a process or give advice based on the hidden sentence.",
  "Reflective / Metacognitive: Encourage the learner to reflect on their own beliefs or habits suggested by the hidden sentence.",
];

export const generateWritingPrompts = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not found",
      });
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
    const inspirations = shuffle(cardsInDeck.map((c) => c.term)).slice(
      0,
      7,
    );

    if (inspirations.length < 7) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "You need at least 7 cards in the deck to generate prompts.",
      });
    }
    const shuffledPrompts = shuffle(promptTemplates);
    // 3. Specify exactly which three types of prompts to generate
    const promptTasks = `
Create one of each of these prompt types:
1. Prompt: ${shuffledPrompts[0]}
   Inspiration: ${inspirations[0]}
2. Prompt: ${shuffledPrompts[1]}
   Inspiration: ${inspirations[1]}
3. Prompt: ${shuffledPrompts[2]}
   Inspiration: ${inspirations[2]}
`.trim();

    // 4. Put it all together, and remind it to write in the learner’s target language
    let systemPrompt = `
${promptIntro}

${promptTasks}

Write each prompt directly in ${getLangName(
      langCode,
    )}, without numbering or labels.
`.trim();
    console.log(systemPrompt);
    // Call OpenAI
    const aiResponse = await openai.beta.chat.completions.parse({
      model: "gpt-4.1",
      // reasoning_effort: "low",
      messages: [{ role: "system", content: systemPrompt }],
    });

    console.log(systemPrompt);
    // Split the AI's output into individual prompts
    const raw = aiResponse.choices[0].message.content || "";
    let prompts = raw
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter((line) => line);

    const refinementPrompt =
      "Think about what makes a writing prompt good." +
      " Re-write the prompts to simplify them and make them better for writing practice." +
      " Be clear about what is being written about- concerete is better than abstract." +
      " Concise is better than open-ended." +
      " One prompt per line, no numbers or commentary please.";

    // Refine the generated prompts using the refinement prompt
    const refinedResponse = await openai.beta.chat.completions.parse({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: refinementPrompt,
        },
        {
          role: "user",
          content: prompts.join("\n\n"),
        },
      ],
    });

    const refinedRaw = refinedResponse.choices[0].message.content || "";
    const refinedPrompts = refinedRaw
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter((line) => line);

    return refinedPrompts;
  });
