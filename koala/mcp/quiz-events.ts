import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Prisma } from "@/koala/generated/prisma/client";
import { z } from "zod";
import { prismaClient } from "@/koala/prisma-client";
import { quizSelect } from "./record-selects";
import { summarizeRecord } from "./search";
import {
  dateFilters,
  dateWhere,
  idSchema,
  registerStudyTool,
} from "./tools";

const inputSchema = z
  .object({
    ...dateFilters,
    eventType: z.string().trim().min(1).max(100).optional(),
    isAcceptable: z.boolean().optional(),
    limit: z.number().int().min(1).max(100).default(30),
    cursor: z
      .object({
        createdAt: z.string().datetime({ offset: true }),
        id: idSchema,
      })
      .strict()
      .optional(),
  })
  .strict();

type QuizEventInput = z.infer<typeof inputSchema>;

function beforeCursor(
  cursor: QuizEventInput["cursor"],
): Prisma.QuizResultWhereInput {
  if (!cursor) {
    return {};
  }
  const createdAt = new Date(cursor.createdAt);
  return {
    OR: [
      { createdAt: { lt: createdAt } },
      { createdAt, id: { lt: cursor.id } },
    ],
  };
}

export async function listQuizEvents(
  userId: string,
  input: QuizEventInput,
) {
  const where: Prisma.QuizResultWhereInput = {
    userId,
    createdAt: dateWhere(input),
    ...(input.eventType === undefined
      ? {}
      : { eventType: input.eventType }),
    ...(input.isAcceptable === undefined
      ? {}
      : { isAcceptable: input.isAcceptable }),
  };
  const [rows, total] = await Promise.all([
    prismaClient.quizResult.findMany({
      where: { AND: [where, beforeCursor(input.cursor)] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      select: quizSelect,
    }),
    prismaClient.quizResult.count({ where }),
  ]);
  const page = rows.slice(0, input.limit);
  const last = page.at(-1);
  const nextCursor =
    rows.length > input.limit && last
      ? { createdAt: last.createdAt.toISOString(), id: last.id }
      : null;
  return {
    items: page.map((row) => summarizeRecord("quiz_result", row)),
    total,
    nextCursor,
    order: "createdAt descending, id descending",
    notes: [
      "Each item is one stored quiz event. Repeated attempts are preserved, including answers to cards that were renamed or deleted. Term and definition reflect the saved event, not current card wording.",
      "Without eventType, all quiz event types are included. Use speaking-judgement for graded card answers. These events are not a complete log of scheduling or passive reviews.",
      "total counts all events matching the filters, not just this page. Follow nextCursor with the same filters for older events; a null cursor means the list is complete. Records can change between calls.",
    ],
  };
}

export function registerQuizEventsTool(server: McpServer, userId: string) {
  registerStudyTool(server, {
    name: "list_quiz_events",
    title: "List recent quiz events",
    description:
      "Read the last N recorded quiz events in chronological order, newest first, with saved term, definition, learner answer, grade, correctness, and feedback. Use for reviewing recent card attempts and recurring mistakes; repeated attempts are never collapsed. Defaults to 30 events of all types; set eventType to speaking-judgement for graded card answers. Optional from/to dates are inclusive/exclusive with offsets; isAcceptable filters outcomes. Follow nextCursor with the same filters for earlier pages, including events sharing a timestamp. Does not require cards to still exist and never modifies study records.",
    input: inputSchema,
    run: (input) => listQuizEvents(userId, input),
  });
}
