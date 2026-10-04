import assert from "node:assert/strict";
import test from "node:test";
import { prismaClient } from "../koala/prisma-client.ts";
import { router } from "../koala/trpc-procedure.ts";
import { gradeSpeakingQuiz } from "../koala/trpc-routes/grade-speaking-quiz.ts";
import type { SpeakingGrade } from "../koala/quiz-evaluators/grading-policy.ts";
import type { JevGrade } from "../koala/quiz-evaluators/jev.ts";
import { jevResponse, speakingInput } from "./jev-fixtures.ts";

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

function stubProviders(
  t: test.TestContext,
  choice: JevGrade,
  confidence: number,
  finalGrade: SpeakingGrade = "correct",
) {
  const previousJevKey = process.env.TYPESAFE_API_KEY;
  const previousOpenaiKey = process.env.OPENAI_API_KEY;
  process.env.TYPESAFE_API_KEY = "test-jev-key";
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
    const request = JSON.parse(String(init?.body));
    if (String(url) === "https://api.typesafe.ai/v1/systemone") {
      calls.push("jev");
      assert.deepEqual(request.state, {
        ...speakingInput,
        deckName: "Daily speech",
        deckDescription: "Everyday sentences",
      });
      return Response.json(jevResponse(choice, confidence));
    }
    assert.equal(
      String(url),
      "https://api.openai.com/v1/chat/completions",
    );
    assert.equal(request.model, "gpt-6-astra");
    assert.equal(request.response_format.type, "json_schema");
    calls.push("openai");
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
            content: JSON.stringify({
              grade: finalGrade,
              feedback: "Use 물을 부은 후.",
            }),
            refusal: null,
          },
        },
      ],
    });
  };
  return calls;
}

test("confident JEV correct is saved and returned without OpenAI", async (t) => {
  const calls = stubProviders(t, "correct", 0.96);
  const result = await caller.gradeSpeakingQuiz({
    cardID: cardId,
    userInput: speakingInput.response,
  });
  assert.deepEqual(calls, ["jev"]);
  assert.equal(result.grade, "correct");
  assert.equal(result.isCorrect, true);
  assert.ok(result.quizResultId);
  const saved = await prismaClient.quizResult.findUniqueOrThrow({
    where: { id: result.quizResultId },
  });
  assert.equal(saved.userId, runId);
  assert.equal(saved.grade, result.grade);
  assert.equal(saved.isAcceptable, true);
  assert.equal(saved.reason, result.feedback);
  assert.equal(saved.gradingSource, "jev");
  assert.equal(saved.jevGrade, "correct");
  assert.equal(saved.jevConfidence, 0.96);
});

test("JEV give-up saves an incorrect grade and skips OpenAI", async (t) => {
  const calls = stubProviders(t, "user_gave_up", 0.99);
  const result = await caller.gradeSpeakingQuiz({
    cardID: cardId,
    userInput: speakingInput.response,
  });
  assert.deepEqual(calls, ["jev"]);
  assert.equal(result.grade, "incorrect");
  assert.equal(result.isCorrect, false);
  const saved = await prismaClient.quizResult.findUniqueOrThrow({
    where: { id: result.quizResultId ?? -1 },
  });
  assert.equal(saved.isAcceptable, false);
  assert.equal(saved.jevGrade, "user_gave_up");
});

test("JEV partial reaches the actual OpenAI wrapper and final partial counts as successful", async (t) => {
  const calls = stubProviders(
    t,
    "partially_correct",
    0.99,
    "partially_correct",
  );
  const result = await caller.gradeSpeakingQuiz({
    cardID: cardId,
    userInput: speakingInput.response,
  });
  assert.deepEqual(calls, ["jev", "openai"]);
  assert.equal(result.grade, "partially_correct");
  assert.equal(result.isCorrect, true);
  assert.equal(result.feedback, "Use 물을 부은 후. (very close)");
  const saved = await prismaClient.quizResult.findUniqueOrThrow({
    where: { id: result.quizResultId ?? -1 },
  });
  assert.equal(saved.gradingSource, "openai");
  assert.equal(saved.grade, "partially_correct");
  assert.equal(saved.isAcceptable, true);
  assert.equal(saved.jevConfidence, 0.99);
});

test("at exactly 85 percent GPT can overturn a JEV correct", async (t) => {
  const calls = stubProviders(t, "correct", 0.85, "incorrect");
  const result = await caller.gradeSpeakingQuiz({
    cardID: cardId,
    userInput: speakingInput.response,
  });
  assert.deepEqual(calls, ["jev", "openai"]);
  assert.equal(result.grade, "incorrect");
  assert.equal(result.isCorrect, false);
});

test("placeholder JEV keys fall back to GPT without sending a JEV request", async (t) => {
  const calls = stubProviders(t, "correct", 1);
  process.env.TYPESAFE_API_KEY = "0000";
  const result = await caller.gradeSpeakingQuiz({
    cardID: cardId,
    userInput: speakingInput.response,
  });
  assert.deepEqual(calls, ["openai"]);
  const saved = await prismaClient.quizResult.findUniqueOrThrow({
    where: { id: result.quizResultId ?? -1 },
  });
  assert.equal(saved.jevGrade, null);
  assert.equal(saved.jevConfidence, null);
});

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
