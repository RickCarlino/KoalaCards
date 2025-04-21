import { z } from "zod";
import { prismaClient } from "../prisma-client";
import { procedure } from "../trpc-procedure";
import { backfillDecks } from "../decks/backfill-decks";
import { LANG_CODES } from "../shared-types";
import { TRPCError } from "@trpc/server"; // Added TRPCError

// Corrected input schema
const inputSchema = z.object({
  deckId: z.number().optional(), // Allow adding to existing deck by ID
  langCode: LANG_CODES.optional(), // Optional if deckId is provided
  deckName: z.string().optional(), // Optional if deckId is provided
  input: z
    .array(
      // Corrected inner object definition
      z.object({
        term: z.string().max(200),
        definition: z.string().max(200),
        gender: z.union([z.literal("M"), z.literal("F"), z.literal("N")]),
      }),
    )
    .max(3000), // Apply max length to the array
});

// Corrected output schema definition
const outputSchema = z.array(
  z.object({
    term: z.string(),
    definition: z.string(),
  }),
);

// Restore the procedure export and structure
export const bulkCreateCards = procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input, ctx }) => {
    const results: { term: string; definition: string }[] = [];
    const userId = ctx.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
    }

    let deck;
    let langCode: z.infer<typeof LANG_CODES>; // Variable to hold the final langCode

    if (input.deckId) {
      // If deckId is provided, find the deck by ID and verify ownership
      deck = await prismaClient.deck.findUnique({
        where: { id: input.deckId, userId },
      });
      if (!deck) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Deck with ID ${input.deckId} not found or access denied.`,
        });
      }
      langCode = deck.langCode as z.infer<typeof LANG_CODES>; // Get langCode from the found deck
    } else if (input.deckName && input.langCode) {
      // If deckId is not provided, use deckName and langCode to find or create
      langCode = input.langCode; // Use provided langCode
      deck = await prismaClient.deck.findFirst({
        where: {
          userId,
          langCode: langCode,
          name: input.deckName,
        },
      });
      if (!deck) {
        deck = await prismaClient.deck.create({
          data: {
            userId,
            langCode: langCode,
            name: input.deckName,
          },
        });
      }
    } else {
      // Invalid input: missing either deckId or (deckName + langCode)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Input must include either 'deckId' or both 'deckName' and 'langCode'.",
      });
    }

    // Now 'deck' and 'langCode' are guaranteed to be set
    const deckId = deck.id;

    for (const i of input.input) {
      const { term: foreignLanguage, definition: english, gender } = i;
      const alreadyExists = await prismaClient.card.findFirst({
        where: {
          userId,
          term: foreignLanguage,
        },
      });
      if (!alreadyExists) {
        const data = {
          userId,
          langCode: langCode, // Use the determined langCode
          term: foreignLanguage,
          definition: english,
          deckId: deckId, // Use the determined deckId
          gender,
        };
        // console.log("Creating card:", data); // Keep console log commented unless debugging
        const card = await prismaClient.card.create({
          data,
        });
        // Default quiz types for new cards
        const quizTypes = ["listening", "speaking"];
        // console.log(`=== CREATE QUIZES FOR ${quizTypes.sort().join(", ")} ===`); // Keep console log commented
        // Use Promise.all for concurrent quiz creation
        await Promise.all(
          quizTypes.map(async (quizType) => {
            return prismaClient.quiz.create({
              data: {
                cardId: card.id,
                quizType,
                stability: 0,
                difficulty: 0,
                firstReview: 0,
                lastReview: 0,
                nextReview: 0,
                lapses: 0,
                repetitions: 0,
              },
            });
          }),
        ); // Added closing parenthesis for map and Promise.all
        results.push({
          term: foreignLanguage,
          definition: english,
        });
      } else {
        const ERR = "(Duplicate) ";
        results.push({
          term: ERR + foreignLanguage,
          definition: ERR + english,
        });
      }
    }
    await backfillDecks(userId);
    return results;
  });
