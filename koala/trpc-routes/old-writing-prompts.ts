import { shuffle } from "radash";
import { z } from "zod";
import { getLangName } from "../get-lang-name";
import { openai } from "../openai";
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
- Writing about "a time you overcame X" is cliche. Stop doing that.
`.trim();

const promptTemplates = [
  "Comparative / Evaluative: Compare two ideas or experiences implied by the hidden sentence.",
  "Descriptive: Describe a scene or object suggested by the hidden sentence.",
  "Opinion / Argument: Give and support a viewpoint on a topic inspired by the hidden sentence.",
  "Personal Narrative: Draw on the theme hinted by the hidden sentence.",
  "Procedural / How-to: Explain a process or give advice based on the hidden sentence.",
  "Reflective / Metacognitive: Encourage the learner to reflect on their beliefs or habits suggested by the hidden sentence.",
  "Scenario + Response: Ask the learner to act a role in a particular scenario.",
];

const MIN_CARDS = 7;

const chat = async (system: string, user?: string) =>
  openai.beta.chat.completions.parse({
    model: "gpt-4.1",
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
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

    const deck = await prismaClient.deck.findUnique({
      where: { id: input.deckId, userId },
    });

    if (!deck) throw new TRPCError({ code: "NOT_FOUND" });

    const cards = await prismaClient.card.findMany({
      where: { userId, deckId: input.deckId },
      select: { term: true },
      take: 100,
    });
    if (cards.length < MIN_CARDS)
      throw new TRPCError({ code: "BAD_REQUEST" });

    const getSeeds = () =>
      shuffle(cards.map(({ term }) => term)).slice(0, MIN_CARDS);

    const raw = await Promise.all([
      draftPrompts(getSeeds(), deck),
      draftPrompts(getSeeds(), deck),
      draftPrompts(getSeeds(), deck),
    ]);

    const refinedRaw = await refinePrompts(raw.join("\n\n"));
    return refinedRaw
      .split(/\r?\n+/)
      .filter(Boolean)
      .map((s) => s.trim())
      .sort((x, y) => x.length - y.length)
      .slice(0, 4);
  });

async function refinePrompts(raw: string) {
  const firstPass = raw
    .split(/\r?\n+/)
    .filter(Boolean)
    .map((s) => s.trim())
    .join("\n");

  const refinement = `You are a creative writing instructor for language learners.
  You have been given a list of writing prompts, each one on its own line.
  These prompts are intended for language learners, and they should be engaging and appropriate for that audience.
  Your task is to refine the following writing prompts so that they make sense and are of high quality.
  Make sure that t:`;

  const refinedRaw =
    (await chat(refinement, firstPass)).choices[0].message.content ?? "";
  return refinedRaw;
}

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
    `Write each prompt directly in ${getLangName(
      deck.langCode,
    )}, without numbering or labels.`,
  ].join("\n\n");

  const raw = (await chat(systemPrompt)).choices[0].message.content ?? "";
  return raw;
}
