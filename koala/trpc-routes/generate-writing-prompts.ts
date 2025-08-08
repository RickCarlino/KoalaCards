import { shuffle } from "radash";
import { z } from "zod";
import { getLangName } from "../get-lang-name";
import { generateAIText } from "../ai";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { TRPCError } from "@trpc/server";

const inputSchema = z.object({ deckId: z.number() });
const outputSchema = z.array(z.string());

const promptIntro = `
You are a creative writing instructor for language learners.
Using three hidden example sentences only as loose inspiration, generate three distinct, engaging prompts.
- Do NOT reveal, paraphrase, or reference the example sentences directly.
- Treat each example sentence purely as a thematic springboard.
- Focus on natural, contextually appropriate phrasing suited to learners.
- Avoid overly literal or off-beat interpretations of the hidden sentences.
- Writing about "a time you overcame X" is cliché. Stop doing that.
- Reply in the target language (not English).
`.trim();

const promptTemplates = [
  // "Comparative / Evaluative: Compare two ideas or experiences implied by the hidden sentence.",
  "Opinion / Argument: Give and support a viewpoint on a topic inspired by the hidden sentence.",
  "Personal Narrative: Draw on the theme hinted by the hidden sentence.",
  "Procedural / How-to: Explain a process or give advice based on the hidden sentence.",
  "Reflective / Metacognitive: Encourage the learner to reflect on their beliefs or habits suggested by the hidden sentence.",
  "Scenario + Response: Ask the learner to act a role in a particular scenario.",
];

const MIN_CARDS = 7;

const chat = async (system: string, user?: string) =>
  generateAIText({
    model: "openai:default",
    messages: user
      ? [
          { role: "system", content: system },
          { role: "user", content: user },
        ]
      : [{ role: "system", content: system }],
  });

export const generateWritingPrompts = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const deck = await prismaClient.deck.findUnique({
      where: { id: input.deckId, userId },
    });
    if (!deck) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    const cards = await prismaClient.card.findMany({
      where: { userId, deckId: input.deckId },
      select: { term: true },
      take: 1000,
    });
    if (cards.length < MIN_CARDS) {
      throw new TRPCError({ code: "BAD_REQUEST" });
    }

    const pickSeeds = () =>
      shuffle(cards.map(({ term }) => term)).slice(0, MIN_CARDS);

    const rawDrafts = await Promise.all([
      draftPrompts(pickSeeds(), deck),
      draftPrompts(pickSeeds(), deck),
      draftPrompts(pickSeeds(), deck),
    ]);

    const refined = await refinePrompts(rawDrafts.join("\n\n"));

    return postProcess(refined).slice(0, 4);
  });

async function draftPrompts(
  seeds: string[],
  deck: {
    name: string;
    id: number;
    createdAt: Date;
    userId: string;
    langCode: string;
    published: boolean;
    parentDeckId: number | null;
  },
) {
  const tasks = shuffle(promptTemplates)
    .slice(0, 3)
    .map((tpl, i) => `Prompt: ${tpl}\nInspiration: ${seeds[i]}`)
    .join("\n\n");

  const systemPrompt = [
    promptIntro,
    tasks,
    `Write your response in ${getLangName(
      deck.langCode,
    )} (not English). **No numbering, bullets, or labels** - one per line, no extra text.`,
  ].join("\n\n");

  console.log(systemPrompt);
  const response = await chat(systemPrompt);
  return response ?? "";
}

async function refinePrompts(raw: string) {
  const firstPass = raw
    .split(/\r?\n+/)
    .filter(Boolean)
    .map((s) => s.trim())
    .join("\n");

  const systemPrompt =
    `You are a creative writing instructor for language learners.\n\n` +
    `Below is a rough list of writing prompts. Please rewrite **each** prompt so it is clear, natural, and engaging **for the target language learner**.\n` +
    `Return **only** the final prompts - one per line - with **no numbering, bullets, or commentary**.`;

  const refined = (await chat(systemPrompt, firstPass)) ?? "";
  return refined;
}

function postProcess(raw: string): string[] {
  return raw
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => a.length - b.length);
}
