import assert from "node:assert/strict";
import test from "node:test";
import { prismaClient } from "../koala/prisma-client.ts";
import { router } from "../koala/trpc-procedure.ts";
import { gradeSpeakingQuiz } from "../koala/trpc-routes/grade-speaking-quiz.ts";
import { speakingGrades } from "../koala/quiz-evaluators/grading-policy.ts";
import { speakingInput } from "./speaking-grading-fixtures.ts";

const testRouter = router({ gradeSpeakingQuiz });
const runId = `speaking-grading-${crypto.randomUUID()}`;
let caller: ReturnType<typeof testRouter.createCaller>;
let cardId: number;
let otherCardId: number;
let providerFetch: typeof fetch = async () =>
  assert.fail("Unexpected provider request");

test.before(async () => {
  test.mock.method(
    globalThis,
    "fetch",
    (...args: Parameters<typeof fetch>) => providerFetch(...args),
  );
  const user = await prismaClient.user.create({
    data: { id: runId, userSettings: { create: {} } },
  });
  const otherUser = await prismaClient.user.create({
    data: { id: `${runId}-other` },
  });
  for (const owner of [user, otherUser]) {
    const deck = await prismaClient.deck.create({
      data: {
        userId: owner.id,
        name: "Daily speech",
        description: "Everyday sentences",
      },
    });
    const card = await prismaClient.card.create({
      data: {
        userId: owner.id,
        deckId: deck.id,
        term: speakingInput.possibleAnswer,
        definition: speakingInput.prompt,
      },
    });
    if (owner.id === user.id) {
      cardId = card.id;
    } else {
      otherCardId = card.id;
    }
  }
  caller = testRouter.createCaller({ session: {} as never, user });
});

test.after(async () => {
  test.mock.restoreAll();
  await prismaClient.user.deleteMany({
    where: { id: { in: [runId, `${runId}-other`] } },
  });
  await prismaClient.$disconnect();
});

function stubOpenAI(
  t: test.TestContext,
  evaluation: unknown,
  status = 200,
) {
  const previousJevKey = process.env.TYPESAFE_API_KEY;
  const previousOpenaiKey = process.env.OPENAI_API_KEY;
  process.env.TYPESAFE_API_KEY = "test-unused-key";
  process.env.OPENAI_API_KEY = "test-openai-key";
  t.after(() => {
    if (previousJevKey === undefined) {
      delete process.env.TYPESAFE_API_KEY;
    } else {
      process.env.TYPESAFE_API_KEY = previousJevKey;
    }
    if (previousOpenaiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousOpenaiKey;
    }
  });
  const calls: string[] = [];
  providerFetch = async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    assert.equal(
      String(url),
      "https://api.openai.com/v1/chat/completions",
    );
    const request = JSON.parse(String(init?.body));
    assert.equal(request.model, "gpt-6.1-sol");
    assert.equal(request.response_format.type, "json_schema");
    assert.equal(request.messages[0].role, "system");
    assert.equal(request.messages[1].role, "user");
    assert.deepEqual(JSON.parse(request.messages[1].content), {
      ...speakingInput,
      deckName: "Daily speech",
      deckDescription: "Everyday sentences",
    });
    calls.push("openai");
    if (status !== 200) {
      return Response.json(
        { error: { message: "Unavailable" } },
        { status },
      );
    }
    return Response.json({
      id: "test-completion",
      object: "chat.completion",
      created: 0,
      model: request.model,
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: JSON.stringify(evaluation),
            refusal: null,
          },
        },
      ],
    });
  };
  return calls;
}

for (const grade of speakingGrades) {
  test(`LLM ${grade} is returned and saved without JEV`, async (t) => {
    const calls = stubOpenAI(t, { grade, feedback: "Final feedback." });
    const result = await caller.gradeSpeakingQuiz({
      cardID: cardId,
      userInput: speakingInput.response,
    });
    assert.deepEqual(calls, ["openai"]);
    assert.equal(result.grade, grade);
    assert.equal(result.isCorrect, grade !== "incorrect");
    assert.equal(
      result.feedback,
      grade === "partially_correct"
        ? "Final feedback. (slightly off)"
        : "Final feedback.",
    );
    assert.ok(result.quizResultId);
    const saved = await prismaClient.quizResult.findUniqueOrThrow({
      where: { id: result.quizResultId },
    });
    assert.equal(saved.userId, runId);
    assert.equal(saved.grade, grade);
    assert.equal(saved.isAcceptable, result.isCorrect);
    assert.equal(saved.reason, result.feedback);
    assert.equal(saved.gradingSource, "openai");
    assert.equal(saved.jevGrade, null);
    assert.equal(saved.jevConfidence, null);
  });
}

for (const [name, status, evaluation] of [
  ["provider error", 401, null],
  ["unsupported grade", 200, { grade: "other", feedback: "No" }],
  ["empty feedback", 200, { grade: "correct", feedback: " " }],
] as const) {
  test(`an LLM ${name} does not save a quiz result`, async (t) => {
    const calls = stubOpenAI(t, evaluation, status);
    const before = await prismaClient.quizResult.count({
      where: { userId: runId },
    });
    await assert.rejects(
      caller.gradeSpeakingQuiz({
        cardID: cardId,
        userInput: speakingInput.response,
      }),
    );
    assert.deepEqual(calls, ["openai"]);
    assert.equal(
      await prismaClient.quizResult.count({ where: { userId: runId } }),
      before,
    );
  });
}

test("unauthenticated, missing, and unowned cards never reach providers or create results", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () =>
    assert.fail("Unauthorized grading must not call providers"),
  );
  const before = await prismaClient.quizResult.count({
    where: { userId: runId },
  });
  await assert.rejects(
    caller.gradeSpeakingQuiz({
      cardID: otherCardId,
      userInput: "private answer",
    }),
    /Not your card/,
  );
  await assert.rejects(
    caller.gradeSpeakingQuiz({ cardID: -1, userInput: "private answer" }),
    /Card not found/,
  );
  const anonymous = testRouter.createCaller({ session: null });
  await assert.rejects(
    anonymous.gradeSpeakingQuiz({
      cardID: cardId,
      userInput: "private answer",
    }),
    /Please log in/,
  );
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.equal(
    await prismaClient.quizResult.count({ where: { userId: runId } }),
    before,
  );
});
