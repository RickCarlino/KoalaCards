import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prismaClient as db } from "@/koala/prisma-client";
import { recordKeySchema, parseRecordKey, recordUrl } from "./search";
import { registerStudyTool, requireRecord } from "./tools";
import * as selects from "./record-selects";

async function loadRecord(userId: string, key: string) {
  const { kind, id } = parseRecordKey(key);
  const where = { userId, id: Number(id) };
  const readers = {
    deck: () => db.deck.findFirst({ where, select: selects.deckSelect }),
    card: () => db.card.findFirst({ where, select: selects.cardSelect }),
    quiz_result: () =>
      db.quizResult.findFirst({ where, select: selects.quizSelect }),
    review: () =>
      db.cardReviewLog.findFirst({
        where: { userId, id: BigInt(id) },
        select: selects.reviewSelect,
      }),
    writing: () =>
      db.writingSubmission.findFirst({
        where,
        select: selects.writingSelect,
      }),
    article: () =>
      db.readerArticle.findFirst({
        where,
        select: { ...selects.articleSelect, contentText: true },
      }),
    book: () =>
      db.readerBook.findFirst({ where, select: selects.bookSelect }),
    article_highlight: () =>
      db.readerArticleHighlight.findFirst({
        where,
        select: selects.articleHighlightSelect,
      }),
    book_highlight: () =>
      db.readerBookAnnotation.findFirst({
        where,
        select: selects.bookHighlightSelect,
      }),
    call: () =>
      db.languageExchangeCall.findFirst({
        where: { learnerId: userId, id: Number(id) },
        select: selects.callSelect,
      }),
  };
  return { kind, row: requireRecord(await readers[kind]()) };
}

const fetchSchema = z
  .object({
    recordKey: recordKeySchema,
    textOffset: z.number().int().min(0).max(100_000_000).default(0),
    textLimit: z.number().int().min(1).max(20000).default(12000),
  })
  .strict();

function chunkText(
  row: Record<string, unknown>,
  offset: number,
  limit: number,
) {
  const chunks: Record<
    string,
    { totalCharacters: number; nextOffset: number | null }
  > = {};
  const record = { ...row };
  for (const field of [
    "contentText",
    "submission",
    "correction",
    "prompt",
    "selectedText",
    "quote",
    "contextBefore",
    "contextAfter",
    "generalMeaning",
    "meaningInContext",
    "userInput",
    "reason",
  ]) {
    const value = record[field];
    if (typeof value !== "string") {
      continue;
    }
    record[field] = value.slice(offset, offset + limit);
    chunks[field] = {
      totalCharacters: value.length,
      nextOffset: offset + limit < value.length ? offset + limit : null,
    };
  }
  return { record, textChunks: chunks, textOffset: offset };
}

function articleContext(row: Record<string, unknown>) {
  const { occurrencesJson, ...record } = row;
  const occurrences = Array.isArray(occurrencesJson)
    ? occurrencesJson
    : [];
  const occurrence = occurrences[Number(row.selectedOccurrenceIndex)] as
    { before?: unknown; after?: unknown } | undefined;
  return {
    ...record,
    contextBefore:
      typeof occurrence?.before === "string" ? occurrence.before : "",
    contextAfter:
      typeof occurrence?.after === "string" ? occurrence.after : "",
  };
}

export async function fetchStudyRecord(
  userId: string,
  input: z.infer<typeof fetchSchema>,
) {
  const { kind, row } = await loadRecord(userId, input.recordKey);
  const record = kind === "article_highlight" ? articleContext(row) : row;
  return {
    kind,
    recordKey: input.recordKey,
    url: recordUrl(kind, row),
    ...chunkText(record, input.textOffset, input.textLimit),
    ...(kind === "book"
      ? {
          fullTextAvailable: false,
          note: "The EPUB is stored in your browser. Saved highlights and their context are available through search_study_data.",
        }
      : {}),
    ...(kind === "card"
      ? {
          history: {
            reviewFilter: { kind: "review", cardId: row.id },
            answerFilter: { kind: "quiz_result", cardId: row.id },
            note: "Answers are matched by current term; older answers to renamed cards require text search. Card timestamps are Unix milliseconds; zero means unset.",
          },
        }
      : {}),
  };
}

export function registerFetchTool(server: McpServer, userId: string) {
  registerStudyTool(server, {
    name: "fetch_study_record",
    title: "Read a learning record",
    description:
      "Read a recordKey returned by search_study_data or list_due_cards. Includes original/corrected writing, saved article text, highlight explanations, answer feedback, or card scheduling/history details. Long text is paginated per field using textOffset/textLimit and textChunks.nextOffset. Book files are local to the browser, so only saved metadata, progress and highlights are available. Use returned URLs for citations; some links open the containing page. Does not mark anything read or generate audio, grading, or study activity.",
    input: fetchSchema,
    run: (input) => fetchStudyRecord(userId, input),
  });
}
