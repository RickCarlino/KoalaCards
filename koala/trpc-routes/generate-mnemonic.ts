import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { generateAIText } from "../ai";
import { getUserSettings } from "../auth-helpers";
import {
  isMnemonicEligible,
  MNEMONIC_MAX_TERM_LENGTH,
  normalizeMnemonicTerm,
} from "../mnemonic";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";

const inputSchema = z.object({
  cardId: z.number(),
});

const outputSchema = z.object({
  mnemonic: z.string(),
});

const buildMnemonicPrompt = (term: string, definition: string) =>
  [
    "Please suggest a mnemonic for the word to help me remember the meaning.",
    `Target word: ${term}`,
    `Meaning: ${definition}`
  ].join("\n");

const stripCodeFence = (value: string) => {
  const trimmed = value.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (!fenceMatch) {
    return trimmed;
  }
  return fenceMatch[1]?.trim() ?? "";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const tryParseMnemonicJson = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!isRecord(parsed)) {
      return null;
    }
    const mnemonic = parsed.mnemonic;
    if (typeof mnemonic !== "string") {
      return null;
    }
    return mnemonic.trim();
  } catch {
    return null;
  }
};

const cleanMnemonicText = (value: string) => {
  const withoutFences = stripCodeFence(value);
  const fromJson = tryParseMnemonicJson(withoutFences);
  if (fromJson) {
    return fromJson;
  }
  return withoutFences.replace(/^["'`]+|["'`]+$/g, "").trim();
};

const ensureMnemonicText = (value: string) => {
  if (value.length > 0) {
    return value;
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Failed to generate mnemonic.",
  });
};

const ensureMnemonicEligible = (term: string) => {
  if (isMnemonicEligible(term)) {
    return;
  }
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Mnemonics are only available for single words up to ${MNEMONIC_MAX_TERM_LENGTH} characters.`,
  });
};

export const generateMnemonic = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = (await getUserSettings(ctx.user?.id)).user.id;
    const card = await prismaClient.card.findFirst({
      where: {
        id: input.cardId,
        userId,
      },
    });

    if (!card) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Card not found",
      });
    }

    const term = normalizeMnemonicTerm(card.term);
    ensureMnemonicEligible(term);

    const prompt = buildMnemonicPrompt(term, card.definition.trim());

    const response = await generateAIText({
      model: "cheap",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 200,
    });

    const mnemonic = ensureMnemonicText(cleanMnemonicText(response));
    return { mnemonic };
  });
