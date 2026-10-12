import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { NextApiRequest, NextApiResponse } from "next";
import { prismaClient } from "../koala/prisma-client.ts";
import { getStudyReport } from "../koala/study-report.ts";
import {
  disableStudyReportLink,
  getStudyReportLink,
  getStudyReportOwner,
  saveStudyReportLink,
} from "../koala/study-report-link-server.ts";
import reportHandler from "../pages/api/study-report/[token].ts";

test.after(() => prismaClient.$disconnect());

async function withUsers(
  run: (ownerId: string, otherId: string) => Promise<void>,
) {
  const ids = [randomUUID(), randomUUID()];
  await prismaClient.user.createMany({ data: ids.map((id) => ({ id })) });
  try {
    await run(ids[0], ids[1]);
  } finally {
    await prismaClient.user.deleteMany({ where: { id: { in: ids } } });
  }
}

async function requestReport(token: unknown, method = "GET") {
  let status = 200;
  let body: unknown;
  const headers = new Map<string, string>();
  const res = {
    setHeader: (key: string, value: string) => headers.set(key, value),
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  };
  await reportHandler(
    { method, query: { token } } as unknown as NextApiRequest,
    res as unknown as NextApiResponse,
  );
  return { status, body, headers };
}

test("report links are opt-in, stable on copy, isolated, and immediately revocable", async () => {
  await withUsers(async (ownerId, otherId) => {
    assert.equal(await getStudyReportLink(ownerId), null);
    const original = await saveStudyReportLink(ownerId);
    assert.match(original.token, /^[a-f0-9]{64}$/);
    assert.deepEqual(await saveStudyReportLink(ownerId), original);
    const other = await saveStudyReportLink(otherId);
    assert.notEqual(original.token, other.token);
    assert.equal(await getStudyReportOwner(original.token), ownerId);

    const rotated = await saveStudyReportLink(ownerId, true);
    assert.notEqual(rotated.token, original.token);
    assert.equal((await requestReport(original.token)).status, 404);
    assert.equal((await requestReport(rotated.token)).status, 200);

    await disableStudyReportLink(ownerId);
    await disableStudyReportLink(ownerId);
    assert.equal(await getStudyReportLink(ownerId), null);
    assert.equal((await requestReport(rotated.token)).status, 404);
    assert.equal(await getStudyReportOwner(other.token), otherId);
    const reenabled = await saveStudyReportLink(ownerId);
    assert.notEqual(reenabled.token, rotated.token);
    assert.notEqual(reenabled.token, original.token);
  });
});

test("report endpoint rejects invalid links and writes, and prohibits caching and indexing", async () => {
  for (const token of [
    undefined,
    "",
    "../link",
    ["a".repeat(64)],
    "a".repeat(64),
  ]) {
    const response = await requestReport(token);
    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: "Link not found" });
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(
      response.headers.get("X-Robots-Tag"),
      "noindex, nofollow, noarchive",
    );
    assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
  }
  const rejected = await requestReport("a".repeat(64), "POST");
  assert.equal(rejected.status, 405);
  assert.equal(rejected.headers.get("Allow"), "GET");
});

async function seedReportHistory(userId: string) {
  const deck = await prismaClient.deck.create({
    data: { userId, name: "Report test" },
  });
  await prismaClient.card.createMany({
    data: ["improved", "missed"].map((term) => ({
      userId,
      deckId: deck.id,
      term,
      definition: `${term} meaning`,
    })),
  });
  const createdAt = new Date("2026-10-11T12:00:00.000Z");
  await prismaClient.quizResult.createMany({
    data: [
      {
        acceptableTerm: "improved",
        userInput: "old mistake",
        isAcceptable: false,
        createdAt: new Date("2026-10-10"),
      },
      {
        acceptableTerm: "improved",
        userInput: "new correct answer",
        isAcceptable: true,
        createdAt,
      },
      {
        acceptableTerm: "missed",
        userInput: "missed answer",
        isAcceptable: false,
        createdAt,
      },
      {
        acceptableTerm: "improved",
        userInput: "unrelated event",
        isAcceptable: false,
        createdAt,
        eventType: "other",
      },
    ].map((row) => ({
      userId,
      definition: "test",
      reason: "Test grading",
      ...row,
    })),
  });
  await prismaClient.writingSubmission.createMany({
    data: Array.from({ length: 7 }, (_, index) => ({
      userId,
      prompt: "Daily writing",
      submission: `${userId} writing ${index}`,
      correction: "Private correction",
      submissionCharacterCount: 20,
      correctionCharacterCount: 18,
      createdAt: new Date(createdAt.getTime() + index * 1000),
    })),
  });
  return createdAt;
}

async function seedReportHighlights(userId: string) {
  const common = {
    userId,
    selectedTextHash: "word-hash",
    selectedOccurrenceIndex: 0,
    occurrenceCount: 1,
    occurrencesJson: [{ before: "before", match: "단어", after: "after" }],
    status: "READY" as const,
  };
  await prismaClient.readerArticle.create({
    data: {
      userId,
      title: `${userId} article`,
      description: "",
      contentText: "Full private article",
      contentHtml: "",
      highlights: {
        create: {
          ...common,
          selectedText: "단어",
          articleContentHash: "article-hash",
          createdAt: new Date("2026-10-10"),
        },
      },
    },
  });
  await prismaClient.readerBook.create({
    data: {
      userId,
      title: `${userId} book`,
      fingerprint: "report-book",
      fileName: "private.epub",
      fileSize: 100,
      fileLastModified: 0,
      navigationJson: [],
      spineJson: [],
      annotations: {
        create: {
          ...common,
          quote: "단어",
          locatorJson: {},
          sectionTextHash: "section-hash",
          chapterTitle: "Chapter 1",
          createdAt: new Date("2026-10-11"),
        },
      },
    },
  });
}

test("reports use only the link owner's latest outcomes and dated writing, without account data", async () => {
  await withUsers(async (ownerId, otherId) => {
    const createdAt = await seedReportHistory(ownerId);
    await seedReportHistory(otherId);
    await seedReportHighlights(ownerId);
    await seedReportHighlights(otherId);
    const { token } = await saveStudyReportLink(ownerId);
    const response = await requestReport(token);
    assert.equal(response.status, 200);
    const report = response.body as Awaited<
      ReturnType<typeof getStudyReport>
    >;
    assert.equal(report.schemaVersion, 1);
    assert.ok(Number.isFinite(Date.parse(report.generatedAt)));
    assert.equal(report.writingSamples.length, 5);
    assert.equal(
      report.writingSamples[0].submission,
      `${ownerId} writing 6`,
    );
    assert.ok(
      report.writingSamples.every((sample) =>
        Number.isFinite(Date.parse(sample.createdAt)),
      ),
    );
    assert.equal(report.correctOutcomes.length, 1);
    assert.equal(report.correctOutcomes[0].term, "improved");
    assert.equal(
      report.correctOutcomes[0].userInput,
      "new correct answer",
    );
    assert.equal(report.wrongOutcomes.length, 1);
    assert.equal(report.wrongOutcomes[0].term, "missed");
    assert.equal(
      report.wrongOutcomes[0].createdAt,
      createdAt.toISOString(),
    );
    assert.ok(report.wrongOutcomes[0].id > 0);
    assert.equal(report.recentHighlights.length, 2);
    assert.equal(
      report.recentHighlights[0].source,
      `${ownerId} book · Chapter 1`,
    );
    assert.match(report.recentHighlights[0].key, /^book-/);
    assert.equal(report.recentHighlights[1].source, `${ownerId} article`);
    assert.equal(
      report.recentHighlights[0].context,
      "...before {{ 단어 }} after...",
    );
    assert.equal(
      report.recentHighlights[0].createdAt,
      "2026-10-11T00:00:00.000Z",
    );
    const serialized = JSON.stringify(report);
    for (const excluded of [
      otherId,
      '"userId"',
      '"email"',
      '"token"',
      '"correction"',
      "old mistake",
      "unrelated event",
      "Full private article",
      "private.epub",
    ]) {
      assert.equal(serialized.includes(excluded), false, excluded);
    }
  });
});
