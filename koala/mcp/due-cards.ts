import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Prisma } from "@/koala/generated/prisma/client";
import { z } from "zod";
import { prismaClient as db } from "@/koala/prisma-client";
import { cardSelect } from "./record-selects";
import { summarizeRecord } from "./search";
import { idSchema, registerStudyTool } from "./tools";

export function dueCardsWhere(
  userId: string,
  now: number,
  deckId?: number,
): Prisma.CardWhereInput {
  return {
    userId,
    paused: false,
    ...(deckId === undefined ? {} : { deckId }),
    OR: [
      { lastFailure: { gt: 0 } },
      { lastFailure: 0, lastReview: { gt: 0 }, nextReview: { lte: now } },
    ],
  };
}

const dueSchema = z
  .object({
    deckId: idSchema.optional(),
    asOf: z.string().datetime({ offset: true }).optional(),
    cursor: idSchema.optional(),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict();

export async function listDueCards(
  userId: string,
  input: z.infer<typeof dueSchema>,
) {
  const asOf = input.asOf ? new Date(input.asOf) : new Date();
  const where = dueCardsWhere(userId, asOf.getTime(), input.deckId);
  const [rows, total] = await Promise.all([
    db.card.findMany({
      where: {
        ...where,
        ...(input.cursor ? { id: { gt: input.cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: input.limit + 1,
      select: cardSelect,
    }),
    db.card.count({ where }),
  ]);
  const items = rows.slice(0, input.limit).map((card) => ({
    ...summarizeRecord("card", card),
    reviewType: card.lastFailure > 0 ? "remedial" : "scheduled",
    dueAt:
      card.nextReview > 0 ? new Date(card.nextReview).toISOString() : null,
  }));
  return {
    asOf: asOf.toISOString(),
    total,
    items,
    nextCursor:
      rows.length > input.limit ? rows[input.limit - 1].id : null,
    note: "Matches Koala's scheduled and remedial review queues; excludes paused cards, unstudied new cards, and optional passive reviews. Each card appears once. Follow nextCursor with the same asOf and deckId until null to retrieve all due cards. Current card state can change during pagination.",
  };
}

export function registerDueCardsTool(server: McpServer, userId: string) {
  registerStudyTool(server, {
    name: "list_due_cards",
    title: "List cards due for review",
    description:
      "List all currently due scheduled and remedial cards, optionally for one deck. Returns the complete count and paginated cards with wording, due dates, review type and links. Follow nextCursor with the returned asOf until null for the full queue. Excludes paused/new/passive cards. asOf fixes the due-time cutoff, not a historical snapshot or a prediction of future learning. Reading the queue never reviews or reschedules cards.",
    input: dueSchema,
    run: (input) => listDueCards(userId, input),
  });
}
