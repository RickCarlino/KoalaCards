import { z } from "zod";
import { prismaClient } from "@/koala/prisma-client";
import { procedure } from "@/koala/trpc-procedure";
import { TRPCError } from "@trpc/server";
import { generateStructuredOutput } from "@/koala/ai";
import type { CoreMessage } from "@/koala/ai";

const inputSchema = z.object({
  deckId: z.number(),
  userMessage: z.string().min(1).max(2000),
  // Current card details from the active review session (passed from client)
  current: z.object({
    term: z.string().min(1),
    definition: z.string().min(1),
    langCode: z.string().min(1),
    lessonType: z
      .union([
        z.literal("listening"),
        z.literal("speaking"),
        z.literal("new"),
        z.literal("remedial"),
      ])
      .optional(),
  }),
  // Short chat history for follow-ups; only last few messages
  history: z
    .array(
      z.object({
        role: z.union([z.literal("user"), z.literal("assistant")]),
        content: z.string().min(1).max(2000),
      }),
    )
    .max(10)
    .optional(),
  // Optional: still allow some recent context to be included
  recentCount: z.number().int().min(3).max(25).optional(),
});

const suggestionSchema = z.object({
  phrase: z.string().min(1).max(200),
  translation: z.string().min(1).max(200),
  gender: z
    .union([z.literal("M"), z.literal("F"), z.literal("N")])
    .default("N"),
});

const outputSchema = z.object({
  reply: z.string().min(1),
  suggestions: z.array(suggestionSchema).max(10).default([]),
});

export const reviewAssistant = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const deck = await prismaClient.deck.findUnique({
      where: { id: input.deckId, userId },
      select: { id: true, langCode: true, name: true },
    });

    if (!deck) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Deck not found",
      });
    } 

    // Fetch the most recently reviewed cards in this deck for context
    const recent = await prismaClient.quiz.findMany({
      where: { Card: { deckId: deck.id, userId } },
      orderBy: [{ lastReview: "desc" }],
      take: input.recentCount ?? 10,
      select: {
        Card: {
          select: {
            term: true,
            definition: true,
            gender: true,
          },
        },
      },
    });

    const recentPairs = recent
      .map((r) => r.Card)
      .filter(Boolean)
      .map((c) => `• ${c!.term} — ${c!.definition}`)
      .join("\n");

    const system = [
      `You are a helpful language-learning assistant embedded in a flashcard trainer.`,
      `The learner is studying deck "${deck.name}" (${deck.langCode}).`,
      `Use the recent cards as context, but do not reveal or dump them back verbatim unless relevant.`,
      `Keep responses concise and actionable. When appropriate, propose up to 3 fresh flashcard suggestions (phrase/translation).`,
      `Do not add notes or parenthesized information to the translations.`,
      `Only propose high-quality, non-duplicate pairs closely related to the user's topic or the recent cards.`,
      `ALWAYS respond in English.`,
      `Avoid single word card suggestions (lexical clusters, colocations, sentences, phrases are better)`,
    ].join(" \n");

    const contextBlock = [
      `Current card:\n• ${input.current.term} — ${input.current.definition}`,
      input.current.lessonType
        ? `Lesson type: ${input.current.lessonType}`
        : undefined,
      recentPairs
        ? `Recent cards (may be stale):\n${recentPairs}`
        : undefined,
    ]
      .filter(Boolean)
      .join("\n\n");

    // Limit history to last 8 messages on server-side as well
    const limitedHistory = (input.history ?? []).slice(-8);

    const modelMessages: CoreMessage[] = [
      { role: "system", content: system },
      { role: "system", content: contextBlock },
      ...limitedHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: input.userMessage },
    ];

    const schema = z.object({
      reply: z.string().describe("Tutor-style answer to the user."),
      suggestions: z
        .array(suggestionSchema)
        .max(5)
        .default([])
        .describe(
          "Up to 5 term/definition pairs to add as new cards. Omit if none.",
        ),
    });
    const result = await generateStructuredOutput({
      // Use a stronger model for structured output to reduce truncation
      model: ["openai", "default"] as const,
      messages: modelMessages,
      schema,
    });

    const reply = result.reply?.trim() || "";
    const suggestions = (result.suggestions || []).slice(0, 5);

    if (!reply) throw new Error("Empty reply");
    return { reply, suggestions };
  });
