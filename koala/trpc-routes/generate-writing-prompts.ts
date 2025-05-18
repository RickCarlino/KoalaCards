import { shuffle } from "radash";
import { z } from "zod";
import { getLangName } from "../get-lang-name";
import { openai } from "../openai";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { TRPCError } from "@trpc/server";

const inputSchema = z.object({ deckId: z.number() });
const outputSchema = z.array(z.string());

const PROMPT_INTRO = `
You create writing prompts for language‑learners (CEFR B1–C1).
Guidelines:
• one sentence per prompt. Keep it short.
• No references to “overcoming obstacles,” trauma, or hardship.
• Avoid overly abstract or vague language.
• Keep language natural, concrete, and engaging.
• The three hidden example sentences are *inspiration only*; never reveal or paraphrase them.
`.trim();

const PROMPT_TYPES = [
  "Comparative / Evaluative: Compare two ideas or experiences implied by the hidden sentence.",
  "Descriptive: Describe a scene or object suggested by the hidden sentence.",
  "Opinion / Argument: Give and support a viewpoint on a topic inspired by the hidden sentence.",
  "Personal Narrative: Draw on the theme hinted by the hidden sentence.",
  "Procedural / How‑to: Explain a process or give advice based on the hidden sentence.",
  "Reflective / Metacognitive: Encourage the learner to reflect on their beliefs or habits suggested by the hidden sentence.",
  "Scenario + Response: Ask the learner to act a role in a particular scenario.",
];

const DRAFT_COUNT = 3; // number of drafts to generate
const OUTPUT_COUNT = 4; // number of prompts to return
const MIN_CARDS = 7;
const HIGH_TEMP = 1.2; // diversify first draft
const LOW_TEMP = 0.2; // tighten during refinement

const chat = async (system: string, user?: string, temperature = 1) =>
  openai.beta.chat.completions.parse({
    model: "gpt-4.1",
    temperature,
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
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    if (cards.length < MIN_CARDS)
      throw new TRPCError({ code: "BAD_REQUEST" });
    const terms = cards.map(({ term }) => term);
    const rawDrafts = await Promise.all(
      Array.from({ length: DRAFT_COUNT }, () => {
        const seeds2 = shuffle(terms).slice(0, MIN_CARDS);
        return draftPrompts(seeds2, deck);
      }),
    );

    const refined = await refinePrompts(rawDrafts.join("\n\n"));

    const cleaned = refined
      .split(/\r?\n+/)
      .map((t) => t.trim())
      .filter(Boolean);
    return shuffle(cleaned).slice(0, OUTPUT_COUNT); // keep the four best‑sized prompts
  });

async function draftPrompts(seeds: string[], deck: { langCode: string }) {
  const tasks = shuffle(PROMPT_TYPES)
    .slice(0, 2)
    .map((tpl, i) => `Prompt: ${tpl}\nInspiration: ${seeds[i]}`)
    .join("\n\n");

  const systemPrompt = [
    PROMPT_INTRO,
    tasks,
    `Write each prompt directly in ${getLangName(
      deck.langCode,
    )}, no numbers or labels.`,
  ].join("\n\n");

  const response = await chat(systemPrompt, undefined, HIGH_TEMP);
  return response.choices[0].message.content ?? "";
}

async function refinePrompts(raw: string) {
  const compression = raw
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");

  const reviewerPrompt = `You are a writing‑prompt reviewer.
Evaluate the following prompts (one per line) for clarity, concreteness, and suitability for B1–C1 learners.
Revise each prompt so that it:
• stays under 100 characters;
• avoids mentions of overcoming obstacles;
• remains lively and specific.
• (extremely important) Does not sound like LLM generated nonsense.
Return the improved prompts, one per line, with no extra commentary.`;

  const refined = await chat(reviewerPrompt, compression, LOW_TEMP);
  return refined.choices[0].message.content ?? "";
}
