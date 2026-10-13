import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { prismaClient as db } from "../koala/prisma-client.ts";
import { withMcp } from "./mcp-helpers.ts";
import { seedMcpStudy, studyRecordKeys } from "./mcp-study-fixtures.ts";
import { getLessonsDue } from "../koala/fetch-lesson.ts";
import { disableStudyReportLink } from "../koala/study-report-link-server.ts";

test.after(() => db.$disconnect());
const object = z.record(z.string(), z.unknown());
const objects = z.array(object);

async function call(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
) {
  const response = await client.callTool({ name, arguments: args });
  assert.notEqual(response.isError, true, JSON.stringify(response));
  const content = z
    .object({ generatedAt: z.string().datetime(), result: object })
    .parse(response.structuredContent);
  const text = z
    .array(z.object({ type: z.literal("text"), text: z.string() }))
    .parse(response.content);
  assert.deepEqual(JSON.parse(text[0].text), content);
  return content.result;
}

async function denied(
  client: Client,
  name: string,
  args: Record<string, unknown>,
) {
  const response = await client.callTool({ name, arguments: args });
  assert.equal(response.isError, true, JSON.stringify(response));
  return JSON.stringify(response);
}

test("MCP reads every saved learning kind, isolates owners, and excludes credentials without writes", async () => {
  await withMcp(async ({ ownerId, otherId, connect, token }) => {
    const own = await seedMcpStudy(ownerId, "OWNER");
    const other = await seedMcpStudy(otherId, "OTHER-PRIVATE");
    const keys = studyRecordKeys(own);
    const foreignKeys = studyRecordKeys(other);
    const before = await db.card.findUnique({
      where: { id: own.card.id },
    });
    const client = await connect();
    for (const kind of Object.keys(keys) as (keyof typeof keys)[]) {
      const result = await call(client, "search_study_data", { kind });
      assert.ok(Number(result.total) >= 1, kind);
      assert.ok(
        objects
          .parse(result.items)
          .some((row) => row.recordKey === `${kind}:${keys[kind]}`),
      );
      const detail = await call(client, "fetch_study_record", {
        recordKey: `${kind}:${keys[kind]}`,
      });
      assert.equal(detail.recordKey, `${kind}:${keys[kind]}`);
      for (const response of [result, detail]) {
        const json = JSON.stringify(response);
        for (const secret of [
          otherId,
          ownerId,
          token,
          "OTHER-PRIVATE",
          "PRIVATE-SIGNALING",
          "PRIVATE-LOCAL",
          '"userId"',
          '"guestToken"',
        ]) {
          assert.equal(json.includes(secret), false, `${kind}: ${secret}`);
        }
      }
      await denied(client, "fetch_study_record", {
        recordKey: `${kind}:${foreignKeys[kind]}`,
      });
    }
    const detail = await call(client, "fetch_study_record", {
      recordKey: `writing:${own.writing.id}`,
    });
    assert.equal(
      object.parse(detail.record).correction,
      "OWNER correction",
    );
    const book = await call(client, "fetch_study_record", {
      recordKey: `book:${own.book.id}`,
    });
    assert.equal(book.fullTextAvailable, false);
    const context = await call(client, "fetch_study_record", {
      recordKey: `article_highlight:${own.highlight.id}`,
    });
    assert.equal(object.parse(context.record).contextBefore, "before");
    assert.deepEqual(
      await db.card.findUnique({ where: { id: own.card.id } }),
      before,
    );
    assert.equal(
      await db.userSettings.count({ where: { userId: ownerId } }),
      0,
    );
    assert.equal(
      (
        await db.readerArticle.findUnique({
          where: { id: own.article.id },
        })
      )?.readAt,
      null,
    );
  });
});

test("MCP searches text and history with bounded pagination, date boundaries and full article chunks", async () => {
  await withMcp(async ({ ownerId, connect }) => {
    const seed = await seedMcpStudy(ownerId, "SEARCH");
    const client = await connect();
    const first = await call(client, "search_study_data", {
      kind: "quiz_result",
      cardId: seed.card.id,
      limit: 1,
    });
    const second = await call(client, "search_study_data", {
      kind: "quiz_result",
      cardId: seed.card.id,
      limit: 1,
      cursor: first.nextCursor,
    });
    assert.equal(first.total, 2);
    assert.notEqual(
      objects.parse(first.items)[0].id,
      objects.parse(second.items)[0].id,
    );
    assert.equal(second.nextCursor, null);
    const period = await call(client, "search_study_data", {
      kind: "quiz_result",
      from: "2026-10-10T07:00:00-05:00",
      to: "2026-10-11T12:00:00Z",
      isAcceptable: false,
    });
    assert.equal(period.total, 1);
    const match = await call(client, "search_study_data", {
      kind: "article",
      query: "search NEEDLE",
    });
    assert.equal(match.total, 1);
    assert.match(
      String(objects.parse(match.items)[0].excerpt),
      /SEARCH needle/,
    );
    let offset = 0;
    let text = "";
    do {
      const part = await call(client, "fetch_study_record", {
        recordKey: `article:${seed.article.id}`,
        textOffset: offset,
        textLimit: 10000,
      });
      text += object.parse(part.record).contentText;
      const chunk = object.parse(
        object.parse(part.textChunks).contentText,
      );
      if (chunk.nextOffset === null) {
        break;
      }
      offset = Number(chunk.nextOffset);
    } while (offset < 100000);
    assert.equal(text, seed.article.contentText);
    for (const args of [
      { kind: "card", imported: false },
      { kind: "review", query: "ignored" },
      { kind: "card", cursor: `writing:${seed.writing.id}` },
      {
        kind: "card",
        from: "2026-10-12T00:00:00Z",
        to: "2026-10-11T00:00:00Z",
      },
      { kind: "card", limit: 51 },
      { kind: "card", userId: ownerId },
    ]) {
      await denied(client, "search_study_data", args);
    }
  });
});

test("MCP overview calculates true period counts and retains complete quiz history", async () => {
  await withMcp(async ({ ownerId, connect }) => {
    const seed = await seedMcpStudy(ownerId, "TOTALS");
    const client = await connect();
    const result = await call(client, "get_study_overview", {
      from: "2026-10-10T00:00:00Z",
      to: "2026-10-12T00:00:00Z",
    });
    const activity = object.parse(result.activity);
    assert.deepEqual(activity.speakingAnswers, {
      total: 2,
      correct: 1,
      incorrect: 1,
      accuracy: 0.5,
    });
    assert.deepEqual(activity.writing, { submissions: 1, characters: 14 });
    assert.deepEqual(activity.reviewLogs, [
      { coverage: "PARTIAL", count: 1 },
    ]);
    const early = await call(client, "get_study_overview", {
      from: "2026-10-10T00:00:00Z",
      to: "2026-10-11T12:00:00Z",
    });
    assert.equal(
      object.parse(object.parse(early.activity).speakingAnswers).total,
      1,
    );
    const none = await call(client, "get_study_overview", {
      from: "2020-01-01T00:00:00Z",
      to: "2020-01-02T00:00:00Z",
    });
    assert.equal(
      object.parse(object.parse(none.activity).speakingAnswers).accuracy,
      null,
    );
    assert.equal(object.parse(none.currentInventory).activeCards, 1);
    assert.equal(result.settings, null);
    const history = await call(client, "search_study_data", {
      kind: "quiz_result",
      deckId: seed.deck.id,
    });
    assert.equal(history.total, 2);
  });
});

test("MCP due-card pagination matches the app queue and never mutates scheduling", async () => {
  await withMcp(async ({ ownerId, otherId, connect }) => {
    const seed = await seedMcpStudy(ownerId, "DUE");
    const other = await seedMcpStudy(otherId, "FOREIGN");
    const now = new Date("2026-10-13T00:00:00Z");
    await db.card.createMany({
      data: [
        {
          term: "remedial-future",
          lastFailure: 1,
          nextReview: now.getTime() + 86400000,
        },
        { term: "paused", lastFailure: 1, paused: true },
        { term: "new" },
        { term: "future", lastReview: 1, nextReview: now.getTime() + 1 },
        {
          term: "exact-boundary",
          lastReview: 1,
          nextReview: now.getTime(),
        },
      ].map((card) => ({
        userId: ownerId,
        deckId: seed.deck.id,
        definition: "test",
        ...card,
      })),
    });
    const client = await connect();
    const before = await db.card.findMany({
      where: { userId: ownerId },
      orderBy: { id: "asc" },
    });
    let cursor: unknown;
    const ids: unknown[] = [];
    do {
      const page = await call(client, "list_due_cards", {
        deckId: seed.deck.id,
        asOf: now.toISOString(),
        limit: 1,
        ...(cursor ? { cursor } : {}),
      });
      assert.equal(
        page.total,
        await getLessonsDue(seed.deck.id, now.getTime()),
      );
      ids.push(...objects.parse(page.items).map((card) => card.id));
      cursor = page.nextCursor;
    } while (cursor);
    assert.equal(ids.length, 3);
    assert.equal(new Set(ids).size, 3);
    const foreign = await call(client, "list_due_cards", {
      deckId: other.deck.id,
    });
    assert.equal(foreign.total, 0);
    assert.deepEqual(
      await db.card.findMany({
        where: { userId: ownerId },
        orderBy: { id: "asc" },
      }),
      before,
    );
  });
});

test("MCP card creation is owner-scoped, duplicate-safe and safe to retry", async () => {
  await withMcp(async ({ ownerId, otherId, connect }) => {
    const seed = await seedMcpStudy(ownerId, "CREATE");
    const other = await seedMcpStudy(otherId, "OTHER");
    const client = await connect();
    const input = {
      deckId: seed.deck.id,
      cards: [
        { term: "새 표현", definition: "new expression" },
        { term: seed.card.term, definition: "Must not overwrite" },
      ],
    };
    const [first, concurrent] = await Promise.all([
      call(client, "create_cards", input),
      call(client, "create_cards", input),
    ]);
    assert.equal(
      Number(first.createdCount) + Number(concurrent.createdCount),
      1,
    );
    assert.equal(
      (await call(client, "create_cards", input)).createdCount,
      0,
    );
    assert.equal(
      (await db.card.findUnique({ where: { id: seed.card.id } }))
        ?.definition,
      seed.card.definition,
    );
    await denied(client, "create_cards", {
      ...input,
      deckId: other.deck.id,
    });
    await denied(client, "create_cards", {
      ...input,
      cards: [
        { term: "x", definition: "one" },
        { term: "x", definition: "two" },
      ],
    });
    assert.equal(
      await db.card.count({ where: { userId: ownerId, term: "x" } }),
      0,
    );
  });
});

test("MCP editing checks ownership, stale wording and duplicates while preserving review state", async () => {
  await withMcp(async ({ ownerId, otherId, connect }) => {
    const seed = await seedMcpStudy(ownerId, "EDIT");
    const other = await seedMcpStudy(otherId, "OTHER");
    const client = await connect();
    const expected = {
      term: seed.card.term,
      definition: seed.card.definition,
    };
    const input = {
      cardId: seed.card.id,
      expected,
      term: "고친 표현",
      definition: "edited meaning",
    };
    assert.equal((await call(client, "edit_card", input)).changed, true);
    assert.equal((await call(client, "edit_card", input)).changed, false);
    const updated = await db.card.findUniqueOrThrow({
      where: { id: seed.card.id },
    });
    assert.deepEqual(updated, {
      ...seed.card,
      term: input.term,
      definition: input.definition,
    });
    assert.match(
      await denied(client, "edit_card", {
        ...input,
        definition: "stale write",
      }),
      /changed since/,
    );
    await denied(client, "edit_card", { ...input, cardId: other.card.id });
    await denied(client, "edit_card", { ...input, paused: true });
    await db.card.create({
      data: {
        userId: ownerId,
        deckId: seed.deck.id,
        term: "taken",
        definition: "taken",
      },
    });
    assert.match(
      await denied(client, "edit_card", {
        cardId: seed.card.id,
        expected: { term: input.term, definition: input.definition },
        term: "taken",
      }),
      /already uses/,
    );
    assert.equal(
      (
        await db.quizResult.findUniqueOrThrow({
          where: { id: seed.quiz.id },
        })
      ).acceptableTerm,
      expected.term,
    );
    assert.equal(
      (
        await call(client, "search_study_data", {
          kind: "quiz_result",
          query: expected.term,
        })
      ).total,
      2,
    );
    assert.equal(
      (
        await call(client, "search_study_data", {
          kind: "review",
          cardId: seed.card.id,
        })
      ).total,
      1,
    );
  });
});

test("MCP imports article and book highlights using existing rules and preserves source links", async () => {
  await withMcp(async ({ ownerId, otherId, connect }) => {
    const seed = await seedMcpStudy(ownerId, "IMPORT");
    const other = await seedMcpStudy(otherId, "OTHER");
    const client = await connect();
    const input = {
      resource: { kind: "article", publicId: seed.article.publicId },
      deckId: seed.deck.id,
      highlightIds: [
        seed.highlight.id,
        seed.highlight.id,
        other.highlight.id,
      ],
    };
    const result = await call(client, "import_highlights", input);
    assert.deepEqual(result.summary, {
      created: 1,
      duplicate: 0,
      alreadyImported: 0,
      notReady: 0,
      missing: 1,
    });
    assert.equal(
      object.parse(
        (await call(client, "import_highlights", input)).summary,
      ).alreadyImported,
      1,
    );
    const saved = await db.readerArticleHighlight.findUniqueOrThrow({
      where: { id: seed.highlight.id },
    });
    assert.ok(saved.importedCardId);
    const source = await call(client, "search_study_data", {
      kind: "article_highlight",
      cardId: saved.importedCardId,
      imported: true,
    });
    assert.equal(source.total, 1);
    const book = await call(client, "import_highlights", {
      resource: { kind: "book", publicId: seed.book.publicId },
      deckId: seed.deck.id,
      highlightIds: [seed.annotation.id],
    });
    assert.equal(object.parse(book.summary).created, 1);
    await denied(client, "import_highlights", {
      ...input,
      deckId: other.deck.id,
    });
    await denied(client, "import_highlights", {
      ...input,
      resource: { kind: "article", publicId: other.article.publicId },
    });
    const { tools } = await client.listTools();
    for (const tool of tools) {
      assert.equal(
        tool.annotations?.readOnlyHint,
        !["create_cards", "import_highlights", "edit_card"].includes(
          tool.name,
        ),
      );
      assert.equal(
        tool.annotations?.destructiveHint,
        tool.name === "edit_card",
      );
      assert.equal(tool.inputSchema.additionalProperties, false);
    }
  });
});

async function addQuizEvent(
  userId: string,
  input: {
    time: string;
    answer: string;
    correct?: boolean;
    eventType?: string;
  },
) {
  return db.quizResult.create({
    data: {
      userId,
      createdAt: new Date(input.time),
      acceptableTerm: "공부하다",
      definition: "to study",
      userInput: input.answer,
      isAcceptable: input.correct ?? false,
      grade: input.correct ? "correct" : "wrong",
      reason: `Feedback for ${input.answer}`,
      eventType: input.eventType ?? "speaking-judgement",
    },
  });
}

test("MCP quiz events use study dates with stable timestamp ties and preserve repeated attempts", async () => {
  await withMcp(async ({ ownerId, connect }) => {
    const middle = await addQuizEvent(ownerId, {
      time: "2026-10-11T12:00:00Z",
      answer: "middle",
    });
    const tiedFirst = await addQuizEvent(ownerId, {
      time: "2026-10-12T12:00:00Z",
      answer: "tie one",
    });
    const oldest = await addQuizEvent(ownerId, {
      time: "2026-10-10T12:00:00Z",
      answer: "backdated",
    });
    const tiedSecond = await addQuizEvent(ownerId, {
      time: "2026-10-12T12:00:00Z",
      answer: "tie two",
    });
    const tiedLast = await addQuizEvent(ownerId, {
      time: "2026-10-12T12:00:00Z",
      answer: "tie three",
      correct: true,
    });
    const client = await connect();
    const ids: unknown[] = [];
    let cursor: unknown;
    do {
      const page = await call(client, "list_quiz_events", {
        limit: 2,
        ...(cursor ? { cursor } : {}),
      });
      assert.equal(page.total, 5);
      const events = objects.parse(page.items);
      assert.ok(
        events.every((event) => event.acceptableTerm === "공부하다"),
      );
      ids.push(...events.map((event) => event.id));
      cursor = page.nextCursor;
    } while (cursor);
    assert.deepEqual(ids, [
      tiedLast.id,
      tiedSecond.id,
      tiedFirst.id,
      middle.id,
      oldest.id,
    ]);
    const recent = await call(client, "list_quiz_events", { limit: 3 });
    assert.deepEqual(
      objects.parse(recent.items).map((row) => row.id),
      ids.slice(0, 3),
    );
    const event = objects.parse(recent.items)[0];
    assert.equal(event.userInput, "tie three");
    assert.equal(event.grade, "correct");
    assert.equal(event.reason, "Feedback for tie three");
    assert.equal(event.recordKey, `quiz_result:${tiedLast.id}`);
  });
});

test("MCP quiz-event filters and totals stay owner-scoped and reject invalid requests", async () => {
  await withMcp(async ({ ownerId, otherId, token, connect }) => {
    const from = "2026-10-10T07:00:00-05:00";
    const to = "2026-10-11T12:00:00Z";
    await addQuizEvent(ownerId, { time: from, answer: "included" });
    await addQuizEvent(ownerId, {
      time: to,
      answer: "end excluded",
      correct: true,
    });
    await addQuizEvent(ownerId, {
      time: from,
      answer: "other event",
      eventType: "other",
    });
    await addQuizEvent(otherId, { time: from, answer: "FOREIGN-ANSWER" });
    const before = await db.quizResult.findMany({
      where: { userId: ownerId },
      orderBy: { id: "asc" },
    });
    const client = await connect();
    const all = await call(client, "list_quiz_events");
    assert.equal(all.total, 3);
    assert.equal(all.nextCursor, null);
    const filtered = await call(client, "list_quiz_events", {
      from,
      to,
      eventType: "speaking-judgement",
      isAcceptable: false,
    });
    assert.equal(filtered.total, 1);
    assert.equal(objects.parse(filtered.items)[0].userInput, "included");
    for (const secret of [
      ownerId,
      otherId,
      token,
      "FOREIGN-ANSWER",
      '"userId"',
    ]) {
      assert.equal(JSON.stringify(all).includes(secret), false);
    }
    const empty = await call(client, "list_quiz_events", {
      from: "2020-01-01T00:00:00Z",
      to: "2020-01-02T00:00:00Z",
    });
    assert.equal(empty.total, 0);
    assert.deepEqual(empty.items, []);
    assert.equal(empty.nextCursor, null);
    for (const args of [
      { limit: 0 },
      { limit: 101 },
      { from: "not-a-date" },
      { from: to, to: from },
      { cursor: { createdAt: from, id: -1 } },
      { cursor: { createdAt: from, id: 1, userId: otherId } },
      { userId: otherId },
    ]) {
      await denied(client, "list_quiz_events", args);
    }
    assert.deepEqual(
      await db.quizResult.findMany({
        where: { userId: ownerId },
        orderBy: { id: "asc" },
      }),
      before,
    );
  });
});

test("MCP quiz history survives card renames/deletion and a deleted pagination anchor", async () => {
  await withMcp(async ({ ownerId, connect }) => {
    const deck = await db.deck.create({
      data: { userId: ownerId, name: "History" },
    });
    const card = await db.card.create({
      data: {
        userId: ownerId,
        deckId: deck.id,
        term: "공부하다",
        definition: "to study",
      },
    });
    const old = await addQuizEvent(ownerId, {
      time: "2026-10-10T12:00:00Z",
      answer: "older answer",
    });
    const latest = await addQuizEvent(ownerId, {
      time: "2026-10-11T12:00:00Z",
      answer: "newer answer",
    });
    await db.card.update({
      where: { id: card.id },
      data: { term: "renamed" },
    });
    const client = await connect();
    const first = await call(client, "list_quiz_events", { limit: 1 });
    assert.equal(objects.parse(first.items)[0].acceptableTerm, "공부하다");
    await db.card.delete({ where: { id: card.id } });
    assert.equal((await call(client, "list_quiz_events")).total, 2);
    await db.quizResult.delete({ where: { id: latest.id } });
    const next = await call(client, "list_quiz_events", {
      limit: 1,
      cursor: first.nextCursor,
    });
    assert.deepEqual(
      objects.parse(next.items).map((event) => event.id),
      [old.id],
    );
    assert.equal(next.nextCursor, null);
  });
});

test("MCP scopes totals, filters, credentials and every tool to the connection owner", async () => {
  await withMcp(async ({ ownerId, otherId, connect }) => {
    const own = await seedMcpStudy(ownerId, "SCOPE");
    const other = await seedMcpStudy(otherId, "FOREIGN-PRIVATE");
    await db.userSettings.createMany({
      data: [
        { userId: ownerId, dailyWritingGoal: 123 },
        { userId: otherId, dailyWritingGoal: 987 },
      ],
    });
    await db.account.create({
      data: {
        userId: ownerId,
        type: "oauth",
        provider: "scope-test",
        providerAccountId: ownerId,
        access_token: "PRIVATE-OAUTH-ACCESS",
        refresh_token: "PRIVATE-OAUTH-REFRESH",
      },
    });
    await db.session.create({
      data: {
        userId: ownerId,
        sessionToken: "scope-test-" + ownerId,
        expires: new Date(Date.now() + 60000),
      },
    });
    const client = await connect();
    const overview = await call(client, "get_study_overview", {
      from: "2026-10-10T00:00:00Z",
      to: "2026-10-12T00:00:00Z",
    });
    assert.equal(object.parse(overview.settings).dailyWritingGoal, 123);
    assert.equal(object.parse(overview.currentInventory).decks, 1);
    assert.equal(object.parse(overview.currentInventory).activeCards, 1);
    assert.equal(
      object.parse(object.parse(overview.activity).speakingAnswers).total,
      2,
    );
    assert.deepEqual(object.parse(overview.activity).callsCreated, [
      { status: "ENDED", count: 1 },
    ]);
    const due = await call(client, "list_due_cards", {
      asOf: "2026-10-12T00:00:00Z",
    });
    assert.deepEqual(
      objects.parse(due.items).map((card) => card.id),
      [own.card.id],
    );
    const queries = [
      { kind: "card", deckId: other.deck.id },
      { kind: "writing", deckId: other.deck.id },
      { kind: "quiz_result", deckId: other.deck.id },
      { kind: "review", cardId: other.card.id },
      { kind: "review", deckId: other.deck.id },
      { kind: "article_highlight", sourceId: other.article.id },
      { kind: "book_highlight", sourceId: other.book.id },
      { kind: "article_highlight", cardId: other.card.id },
      { kind: "book_highlight", cardId: other.card.id },
    ];
    for (const query of queries) {
      const result = await call(client, "search_study_data", query);
      assert.equal(result.total, 0);
      assert.deepEqual(result.items, []);
    }
    await denied(client, "search_study_data", {
      kind: "quiz_result",
      cardId: other.card.id,
    });
    const validArguments: Record<string, Record<string, unknown>> = {
      get_study_report: {},
      get_study_overview: {},
      list_quiz_events: {},
      list_due_cards: {},
      search_study_data: { kind: "card" },
      fetch_study_record: { recordKey: `card:${own.card.id}` },
      create_cards: {
        deckId: own.deck.id,
        cards: [{ term: "must-not-write", definition: "test" }],
      },
      import_highlights: {
        resource: { kind: "article", publicId: own.article.publicId },
        deckId: own.deck.id,
        highlightIds: [own.highlight.id],
      },
      edit_card: {
        cardId: own.card.id,
        expected: { term: own.card.term, definition: own.card.definition },
        definition: "must-not-write",
      },
    };
    const { tools } = await client.listTools();
    for (const tool of tools) {
      assert.ok(validArguments[tool.name], tool.name);
      await denied(client, tool.name, {
        ...validArguments[tool.name],
        userId: otherId,
      });
    }
    for (const secret of [
      ownerId,
      otherId,
      "PRIVATE-OAUTH-ACCESS",
      "PRIVATE-OAUTH-REFRESH",
      "scope-test-",
      "FOREIGN-PRIVATE",
    ]) {
      assert.equal(
        JSON.stringify({ overview, due }).includes(secret),
        false,
        secret,
      );
    }
    await disableStudyReportLink(ownerId);
    for (const tool of tools) {
      await assert.rejects(
        client.callTool({
          name: tool.name,
          arguments: validArguments[tool.name],
        }),
        /Connection not found/,
      );
    }
    assert.equal(await db.card.count({ where: { userId: ownerId } }), 1);
    assert.equal(
      (await db.card.findUniqueOrThrow({ where: { id: own.card.id } }))
        .definition,
      own.card.definition,
    );
    assert.equal(
      (
        await db.readerArticleHighlight.findUniqueOrThrow({
          where: { id: own.highlight.id },
        })
      ).importedCardId,
      null,
    );
  });
});
