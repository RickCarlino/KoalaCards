import { shuffle, unique } from "radash";
import { z } from "zod";
import { getLangName } from "../get-lang-name";
import { openai } from "../openai";
import { prismaClient } from "../prisma-client";
import { LANG_CODES } from "../shared-types";
import { procedure } from "../trpc-procedure";

const inputSchema = z.object({ langCode: LANG_CODES });
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

    const recentQuizzes = await prismaClient.quiz.findMany({
      where: { Card: { userId, langCode } },
      orderBy: { lastReview: "desc" },
      take: 1000,
      select: { cardId: true },
    });

    const uniqueIds = unique(recentQuizzes.map((q) => q.cardId));
    const sampleIds = shuffle(uniqueIds).slice(0, 7);
    const inspirations = shuffle(
      await prismaClient.card.findMany({
        where: { id: { in: sampleIds } },
        select: { term: true },
      }),
    ).map((c) => c.term);

    if (inspirations.length < 7) {
      return ["Please review more cards to generate prompts."];
    }

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

    selectedTemplates.forEach((tpl, idx) => {
      systemPrompt += `

${idx + 1}. ${tpl.description}
   SECRET: ${inspirations[tpl.secretIndex]}`;
    });

    systemPrompt += `

Write each prompt directly in ${getLangName(
      langCode,
    )}, without titles, labels, or numbering. Use natural phrasing suited to a language learner.`;

    // Call OpenAI
    const aiResponse = await openai.beta.chat.completions.parse({
      model: "gpt-4.1",
      messages: [{ role: "system", content: systemPrompt }],
    });

    console.log(systemPrompt);
    // Split the AI's output into individual prompts
    const raw = aiResponse.choices[0].message.content || "";
    const prompts = raw
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter((line) => line);

    return prompts;
  });
