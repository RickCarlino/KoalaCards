import assert from "node:assert/strict";
import test from "node:test";
import { prismaClient } from "../koala/prisma-client.ts";
import { router } from "../koala/trpc-procedure.ts";
import { gradeSpeakingQuiz } from "../koala/trpc-routes/grade-speaking-quiz.ts";
import { explainQuizResult } from "../koala/trpc-routes/explain-quiz-result.ts";
import { editQuizResult } from "../koala/trpc-routes/edit-quiz-results.ts";
import {
  gradeBuckets,
  reviewGrades,
  type ReviewGrade,
} from "../koala/quiz-evaluators/grade-buckets.ts";
import { speakingInput } from "./speaking-grading-fixtures.ts";

const testRouter = router({
  gradeSpeakingQuiz,
  explainQuizResult,
  editQuizResult,
});
const runId = `review-grading-${crypto.randomUUID()}`;
let caller: ReturnType<typeof testRouter.createCaller>;
let cardId: number;
let otherCardId: number;
let providerFetch: typeof fetch = async () =>
  assert.fail("Unexpected provider request");
const previousKey = process.env.OPENAI_API_KEY;

test.before(async () => {
  process.env.OPENAI_API_KEY = "test-openai-key";
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

test.beforeEach(() => {
  providerFetch = async () => assert.fail("Unexpected provider request");
});

test.after(async () => {
  test.mock.restoreAll();
  if (previousKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = previousKey;
  }
  await prismaClient.user.deleteMany({
    where: { id: { in: [runId, `${runId}-other`] } },
  });
  await prismaClient.$disconnect();
});

function decision(grade: string, confidence = 0.9) {
  return {
    model: "gpt-6-luna",
    answers: [
      {
        type: "choice",
        name: "classification",
        choice: grade,
        confidence,
        probabilities: reviewGrades.map((value) => ({
          value,
          probability: value === grade ? 0.85 : 0.05,
        })),
      },
    ],
    usage: { input_tokens: 100, output_tokens: 0, total_tokens: 100 },
  };
}

function stubDecision(payload: unknown, status = 200) {
  const calls: unknown[] = [];
  providerFetch = async (url, init) => {
    assert.equal(String(url), "https://api.openai.com/v1/decisions");
    const request = JSON.parse(String(init?.body));
    assert.equal(request.model, "gpt-6-luna");
    assert.equal(request.questions.length, 1);
    assert.equal(request.questions[0].type, "choice");
    assert.equal(request.questions[0].name, "classification");
    assert.deepEqual(
      request.questions[0].choices.map((c: { value: string }) => c.value),
      reviewGrades,
    );
    assert.deepEqual(JSON.parse(request.input), {
      ...speakingInput,
      deckName: "Daily speech",
      deckDescription: "Everyday sentences",
    });
    calls.push(request);
    return Response.json(payload, {
      status,
      headers: { "retry-after-ms": "1" },
    });
  };
  return calls;
}

function explanationResponse(
  text = "Both phrases express the same sequence.",
  status = "completed",
) {
  return {
    id: "resp_test",
    object: "response",
    status,
    model: "gpt-6.1-sol",
    output: [
      {
        type: "message",
        id: "msg_test",
        role: "assistant",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({ explanation: text }),
            annotations: [],
          },
        ],
      },
    ],
  };
}

function stubExplanation(
  payload: unknown = explanationResponse(),
  status = 200,
) {
  const calls: unknown[] = [];
  providerFetch = async (url, init) => {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    const request = JSON.parse(String(init?.body));
    assert.equal(request.model, "gpt-6.1-sol");
    assert.equal(request.store, false);
    assert.equal(request.text.format.type, "json_schema");
    assert.equal(request.reasoning.effort, "medium");
    assert.deepEqual(JSON.parse(request.input[1].content), {
      ...speakingInput,
      deckName: "Daily speech",
      deckDescription: "Everyday sentences",
      grade: "correct",
    });
    calls.push(request);
    return Response.json(payload, { status });
  };
  return calls;
}

async function savedReview(
  userId = runId,
  grade: ReviewGrade = "correct",
) {
  return prismaClient.quizResult.create({
    data: {
      userId,
      definition: speakingInput.prompt,
      acceptableTerm: speakingInput.possibleAnswer,
      userInput: speakingInput.response,
      grade,
      isAcceptable: gradeBuckets[grade].isCorrect,
      reason: gradeBuckets[grade].label,
      gradingSource: "openai-decisions",
      gradingModel: "gpt-6-luna",
      gradingConfidence: 0.9,
      gradingContext: {
        deckName: "Daily speech",
        deckDescription: "Everyday sentences",
      },
    },
  });
}

for (const grade of reviewGrades) {
  test(`Decisions ${grade} is returned and saved without an explanation request`, async () => {
    const calls = stubDecision(decision(grade));
    const result = await caller.gradeSpeakingQuiz({
      cardID: cardId,
      userInput: speakingInput.response,
    });
    assert.equal(calls.length, 1);
    assert.equal(result.grade, grade);
    assert.equal(result.isCorrect, gradeBuckets[grade].isCorrect);
    assert.equal(result.feedback, gradeBuckets[grade].label);
    assert.ok(result.quizResultId);
    const saved = await prismaClient.quizResult.findUniqueOrThrow({
      where: { id: result.quizResultId },
    });
    assert.equal(saved.userId, runId);
    assert.equal(saved.grade, grade);
    assert.equal(saved.isAcceptable, result.isCorrect);
    assert.equal(saved.reason, result.feedback);
    assert.equal(saved.gradingSource, "openai-decisions");
    assert.equal(saved.gradingModel, "gpt-6-luna");
    assert.equal(saved.gradingConfidence, 0.9);
    assert.equal(saved.jevGrade, null);
    assert.equal(saved.jevConfidence, null);
    assert.equal(saved.explanation, null);
  });
}

for (const [name, payload, status, attempts] of [
  ["provider error", { error: { message: "Unavailable" } }, 401, 1],
  ["server error", { error: { message: "Unavailable" } }, 500, 2],
  ["unsupported bucket", decision("other"), 200, 1],
  ["legacy bucket", decision("partially_correct"), 200, 1],
  ["missing answer", { model: "gpt-6-luna", answers: [] }, 200, 1],
  [
    "refusal",
    {
      model: "gpt-6-luna",
      answers: [{ type: "refusal", name: "classification" }],
    },
    200,
    1,
  ],
  ["invalid confidence", decision("correct", 2), 200, 1],
  [
    "wrong question",
    {
      ...decision("correct"),
      answers: [{ ...decision("correct").answers[0], name: "another" }],
    },
    200,
    1,
  ],
  [
    "extra answer",
    {
      ...decision("correct"),
      answers: [
        ...decision("correct").answers,
        ...decision("incorrect").answers,
      ],
    },
    200,
    1,
  ],
] as const) {
  test(`a decision ${name} does not save a result or change scheduling`, async () => {
    const calls = stubDecision(payload, status);
    const before = await prismaClient.quizResult.count({
      where: { userId: runId },
    });
    const cardBefore = await prismaClient.card.findUniqueOrThrow({
      where: { id: cardId },
    });
    await assert.rejects(
      caller.gradeSpeakingQuiz({
        cardID: cardId,
        userInput: speakingInput.response,
      }),
    );
    assert.equal(calls.length, attempts);
    assert.equal(
      await prismaClient.quizResult.count({ where: { userId: runId } }),
      before,
    );
    assert.deepEqual(
      await prismaClient.card.findUniqueOrThrow({ where: { id: cardId } }),
      cardBefore,
    );
  });
}

test("low confidence does not secretly change the chosen bucket or call another grader", async () => {
  const calls = stubDecision(decision("slightly_incorrect", 0.1));
  const result = await caller.gradeSpeakingQuiz({
    cardID: cardId,
    userInput: speakingInput.response,
  });
  assert.equal(result.grade, "slightly_incorrect");
  assert.equal(result.isCorrect, false);
  assert.equal(calls.length, 1);
});

test("unauthenticated, missing, unowned, and empty answers never reach providers", async () => {
  const anonymous = testRouter.createCaller({ session: null });
  const noUser = testRouter.createCaller({ session: {} as never });
  for (const [target, input] of [
    [anonymous, { cardID: cardId, userInput: "answer" }],
    [noUser, { cardID: cardId, userInput: "answer" }],
    [caller, { cardID: otherCardId, userInput: "answer" }],
    [caller, { cardID: 2147483647, userInput: "answer" }],
    [caller, { cardID: cardId, userInput: "  " }],
    [caller, { cardID: cardId, userInput: "a".repeat(2001) }],
  ] as const) {
    await assert.rejects(target.gradeSpeakingQuiz(input));
  }
});

test("explanations are opt-in, saved, reused, and cannot change a grade or schedule", async () => {
  const saved = await savedReview();
  const cardBefore = await prismaClient.card.findUniqueOrThrow({
    where: { id: cardId },
  });
  const calls = stubExplanation();
  const first = await caller.explainQuizResult({ resultId: saved.id });
  const cached = await caller.explainQuizResult({ resultId: saved.id });
  assert.deepEqual(first, {
    explanation: "Both phrases express the same sequence.",
  });
  assert.deepEqual(cached, first);
  assert.equal(calls.length, 1);
  const after = await prismaClient.quizResult.findUniqueOrThrow({
    where: { id: saved.id },
  });
  assert.deepEqual(after, { ...saved, explanation: first.explanation });
  assert.deepEqual(
    await prismaClient.card.findUniqueOrThrow({ where: { id: cardId } }),
    cardBefore,
  );
});

test("explanations use saved card and deck context even after card edits", async () => {
  const saved = await savedReview();
  await prismaClient.card.update({
    where: { id: cardId },
    data: { term: "changed", definition: "changed" },
  });
  try {
    const calls = stubExplanation();
    await caller.explainQuizResult({ resultId: saved.id });
    assert.equal(calls.length, 1);
  } finally {
    await prismaClient.card.update({
      where: { id: cardId },
      data: {
        term: speakingInput.possibleAnswer,
        definition: speakingInput.prompt,
      },
    });
  }
});

for (const [name, payload, status] of [
  ["provider error", { error: { message: "Unavailable" } }, 401],
  ["empty explanation", explanationResponse(" "), 200],
  [
    "incomplete response",
    explanationResponse("Partial", "incomplete"),
    200,
  ],
  [
    "refusal",
    {
      ...explanationResponse(),
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "refusal", refusal: "Cannot answer" }],
        },
      ],
    },
    200,
  ],
] as const) {
  test(`an explanation ${name} preserves the grade and can be retried`, async () => {
    const saved = await savedReview();
    stubExplanation(payload, status);
    await assert.rejects(
      caller.explainQuizResult({ resultId: saved.id }),
      /Could not load the explanation/,
    );
    assert.deepEqual(
      await prismaClient.quizResult.findUniqueOrThrow({
        where: { id: saved.id },
      }),
      saved,
    );
    const calls = stubExplanation();
    await caller.explainQuizResult({ resultId: saved.id });
    assert.equal(calls.length, 1);
  });
}

test("explanation authorization and legacy results never call a provider", async () => {
  const own = await savedReview();
  const other = await savedReview(`${runId}-other`);
  const legacy = await savedReview();
  await prismaClient.quizResult.update({
    where: { id: legacy.id },
    data: {
      gradingSource: "openai",
      grade: "partially_correct",
      reason: "Legacy feedback",
    },
  });
  const anonymous = testRouter.createCaller({ session: null });
  const noUser = testRouter.createCaller({ session: {} as never });
  for (const [target, resultId] of [
    [anonymous, own.id],
    [noUser, own.id],
    [caller, other.id],
    [caller, 2147483647],
    [caller, legacy.id],
  ] as const) {
    await assert.rejects(target.explainQuizResult({ resultId }));
  }
  assert.equal(
    (
      await prismaClient.quizResult.findUniqueOrThrow({
        where: { id: legacy.id },
      })
    ).reason,
    "Legacy feedback",
  );
});

test("concurrent explanation requests share a database lease and do not incur duplicate calls", async () => {
  const saved = await savedReview();
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let calls = 0;
  providerFetch = async () => {
    calls += 1;
    started.resolve();
    await release.promise;
    return Response.json(explanationResponse());
  };
  const first = caller.explainQuizResult({ resultId: saved.id });
  await started.promise;
  try {
    await assert.rejects(
      caller.explainQuizResult({ resultId: saved.id }),
      /already loading/,
    );
  } finally {
    release.resolve();
  }
  await first;
  assert.equal(calls, 1);
});

test("an expired explanation lease can be retried", async () => {
  const saved = await savedReview();
  await prismaClient.quizResult.update({
    where: { id: saved.id },
    data: { explanationRequestedAt: new Date(Date.now() - 180_000) },
  });
  const calls = stubExplanation();
  await caller.explainQuizResult({ resultId: saved.id });
  assert.equal(calls.length, 1);
});

test("editing an answer during generation prevents saving a stale explanation", async () => {
  const saved = await savedReview();
  providerFetch = async () => {
    await caller.editQuizResult({
      resultId: saved.id,
      data: { userInput: "changed answer" },
    });
    return Response.json(explanationResponse());
  };
  await assert.rejects(
    caller.explainQuizResult({ resultId: saved.id }),
    /Could not load/,
  );
  const after = await prismaClient.quizResult.findUniqueOrThrow({
    where: { id: saved.id },
  });
  assert.equal(after.explanation, null);
  assert.equal(after.explanationRequestedAt, null);
  assert.equal(after.grade, saved.grade);
});

test("voting keeps a cached explanation, while answer edits invalidate it", async () => {
  const saved = await savedReview();
  stubExplanation();
  await caller.explainQuizResult({ resultId: saved.id });
  await caller.editQuizResult({
    resultId: saved.id,
    data: { helpfulness: 1 },
  });
  assert.ok(
    (
      await prismaClient.quizResult.findUniqueOrThrow({
        where: { id: saved.id },
      })
    ).explanation,
  );
  await caller.editQuizResult({
    resultId: saved.id,
    data: { userInput: "new answer" },
  });
  assert.equal(
    (
      await prismaClient.quizResult.findUniqueOrThrow({
        where: { id: saved.id },
      })
    ).explanation,
    null,
  );
});
