import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Prisma } from "@/koala/generated/prisma/client";
import { z } from "zod";
import { prismaClient as db } from "@/koala/prisma-client";
import { ensureDeckFsrsConfig } from "@/koala/fsrs/scheduler-server";
import { importReaderHighlightsForUser } from "@/koala/trpc-routes/reader-highlights";
import { cardSelect } from "./record-selects";
import { summarizeRecord } from "./search";
import {
  idSchema,
  registerStudyTool,
  requireRecord,
  StudyToolError,
} from "./tools";

const cardWording = z
  .object({
    term: z.string().trim().min(1).max(200),
    definition: z.string().trim().min(1).max(200),
  })
  .strict();
const createSchema = z
  .object({
    deckId: idSchema,
    cards: z.array(cardWording).min(1).max(50),
  })
  .strict();

export async function createStudyCards(
  userId: string,
  input: z.infer<typeof createSchema>,
) {
  const byTerm = new Map<string, string>();
  for (const card of input.cards) {
    if (
      byTerm.has(card.term) &&
      byTerm.get(card.term) !== card.definition
    ) {
      throw new StudyToolError(
        "The same term was supplied with different definitions. Choose one definition before creating cards.",
      );
    }
    byTerm.set(card.term, card.definition);
  }
  return db.$transaction(async (tx) => {
    requireRecord(
      await tx.deck.findFirst({
        where: { id: input.deckId, userId },
        select: { id: true },
      }),
    );
    await ensureDeckFsrsConfig(tx, { userId, deckId: input.deckId });
    const { count } = await tx.card.createMany({
      data: Array.from(byTerm, ([term, definition]) => ({
        userId,
        deckId: input.deckId,
        term,
        definition,
      })),
      skipDuplicates: true,
    });
    const cards = await tx.card.findMany({
      where: { userId, term: { in: [...byTerm.keys()] } },
      select: cardSelect,
      orderBy: { id: "asc" },
    });
    return {
      createdCount: count,
      existingCount: byTerm.size - count,
      cards: cards.map((card) => summarizeRecord("card", card)),
      note: "Existing terms anywhere in your account are returned unchanged, including their existing deck and definition. Repeating this request does not duplicate or overwrite cards.",
    };
  });
}

const editSchema = z
  .object({
    cardId: idSchema,
    expected: z
      .object({
        term: z.string().max(100000),
        definition: z.string().max(100000),
      })
      .strict(),
    term: cardWording.shape.term.optional(),
    definition: cardWording.shape.definition.optional(),
  })
  .strict();

async function editWording(
  userId: string,
  input: z.infer<typeof editSchema>,
) {
  if (input.term === undefined && input.definition === undefined) {
    throw new StudyToolError("Supply a new term or definition.");
  }
  return db.$transaction(async (tx) => {
    const card = requireRecord(
      await tx.card.findFirst({
        where: { id: input.cardId, userId },
        select: cardSelect,
      }),
    );
    const data = {
      term: input.term ?? input.expected.term,
      definition: input.definition ?? input.expected.definition,
    };
    if (card.term === data.term && card.definition === data.definition) {
      return { changed: false, card: summarizeRecord("card", card) };
    }
    const update = await tx.card.updateMany({
      where: { id: input.cardId, userId, ...input.expected },
      data,
    });
    if (update.count !== 1) {
      throw new StudyToolError(
        "The card changed since you read it. Fetch it again and review the current wording before retrying.",
      );
    }
    const updated = requireRecord(
      await tx.card.findFirst({
        where: { id: input.cardId, userId },
        select: cardSelect,
      }),
    );
    return {
      changed: true,
      previous: { term: card.term, definition: card.definition },
      card: summarizeRecord("card", updated),
      historyNote:
        "Scheduling and review logs are unchanged. Quiz answers retain the original expected term; after a rename, search that old term to retrieve them.",
    };
  });
}

export async function editStudyCard(
  userId: string,
  input: z.infer<typeof editSchema>,
) {
  try {
    return await editWording(userId, input);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new StudyToolError(
        "Another card already uses that term. No changes were saved.",
      );
    }
    throw error;
  }
}

const importSchema = z
  .object({
    resource: z
      .object({
        kind: z.enum(["article", "book"]),
        publicId: z.string().trim().min(1).max(200),
      })
      .strict(),
    deckId: idSchema,
    highlightIds: z.array(idSchema).min(1).max(50),
  })
  .strict();

export function registerWriteTools(server: McpServer, userId: string) {
  registerStudyTool(server, {
    name: "create_cards",
    title: "Create cards",
    write: true,
    description:
      "Create up to 50 cards in an existing owned deck when the user asks to save vocabulary. Discover the deck ID first. Existing terms are returned unchanged even if in another deck; retries do not duplicate cards. Does not review cards or generate paid media. Use import_highlights instead when saving existing reader highlights to preserve their source links.",
    input: createSchema,
    run: (input) => createStudyCards(userId, input),
  });
  registerStudyTool(server, {
    name: "import_highlights",
    title: "Import highlights as cards",
    write: true,
    description:
      "Import selected existing article or book highlights into an existing owned deck when requested by the user. Pass the source publicId and highlight IDs from read tools. Reuses Koala's import behavior: creates ready highlights with new terms and links them to cards; skips missing, unready, already imported, or duplicate terms. Existing duplicate terms are not overwritten or moved, and skipped highlights remain unlinked. Returns per-highlight outcomes. Does not create new highlights or review cards.",
    input: importSchema,
    run: async (input) => importReaderHighlightsForUser(userId, input),
  });
  registerStudyTool(server, {
    name: "edit_card",
    title: "Edit card wording",
    write: true,
    destructive: true,
    description:
      "Edit only an owned card's term and/or definition when requested by the user. Fetch the card first and supply its exact current term and definition as expected; stale edits and duplicate terms are rejected. Preserves deck, scheduling, pause status and review statistics. Renaming leaves old quiz answers under the original term (find them by text); review logs remain attached by card ID. Do not change wording merely because a coaching report identifies a possible improvement.",
    input: editSchema,
    run: (input) => editStudyCard(userId, input),
  });
}
