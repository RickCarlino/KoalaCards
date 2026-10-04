import assert from "node:assert/strict";
import test from "node:test";
import { evaluateJev, JevApiError } from "../koala/ai-jev.ts";
import {
  buildJevRequest,
  jevResponseSchema,
} from "../koala/quiz-evaluators/jev.ts";

import { jevResponse, speakingInput as input } from "./jev-fixtures.ts";

const response = jevResponse();

test("Jev sends only grading inputs, never IDs, expected labels, or old judgments", async () => {
  const enrichedInput = {
    ...input,
    id: 1,
    expectedGrade: "correct",
    userId: "private",
    isAcceptable: false,
    reason: "old judgment",
  };
  const request = buildJevRequest(enrichedInput, "jev-test");
  const result = await evaluateJev(request, {
    apiKey: "test-token",
    fetchImplementation: async (url, init) => {
      assert.equal(url, "https://api.typesafe.ai/v1/systemone");
      assert.equal(init?.method, "POST");
      assert.equal(
        new Headers(init?.headers).get("Authorization"),
        "Bearer test-token",
      );
      assert.deepEqual(JSON.parse(String(init?.body)).state, {
        prompt: input.prompt,
        possibleAnswer: input.possibleAnswer,
        response: input.response,
      });
      return Response.json(response);
    },
  });
  assert.deepEqual(jevResponseSchema.parse(result), response);
});

test("Jev refuses missing and placeholder keys before sending data", async () => {
  for (const apiKey of ["", "0000", " 0000 "]) {
    await assert.rejects(
      evaluateJev(buildJevRequest(input, "jev-test"), {
        apiKey,
        fetchImplementation: async () => {
          assert.fail("A placeholder key must never send a request.");
        },
      }),
      /Set TYPESAFE_API_KEY/,
    );
  }
});

test("Jev does not retry an invalid credential or expose the response body", async () => {
  let calls = 0;
  await assert.rejects(
    evaluateJev(buildJevRequest(input, "jev-test"), {
      apiKey: "test-token",
      fetchImplementation: async () => {
        calls += 1;
        return new Response("Sensitive server diagnostic", {
          status: 401,
        });
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof JevApiError);
      assert.equal(error.status, 401);
      assert.equal(error.message, "Jev request failed (HTTP 401).");
      return true;
    },
  );
  assert.equal(calls, 1);
});

test("JEV overload falls back promptly without retries", async () => {
  for (const status of [429, 503, 529]) {
    let calls = 0;
    await assert.rejects(
      evaluateJev(buildJevRequest(input, "jev-test"), {
        apiKey: "test-token",
        fetchImplementation: async (_url, init) => {
          calls += 1;
          assert.ok(init?.signal instanceof AbortSignal);
          return new Response(null, { status });
        },
      }),
      new RegExp(`HTTP ${status}`),
    );
    assert.equal(calls, 1);
  }
});

test("Jev validates all grades, probabilities, and diagnostic answers", () => {
  assert.deepEqual(jevResponseSchema.parse(response), response);
  const invalidResponses = [
    {
      ...response,
      answers: {
        ...response.answers,
        grade: { ...response.answers.grade, choice: "mostly_correct" },
      },
    },
    {
      ...response,
      answers: {
        ...response.answers,
        grade: { ...response.answers.grade, confidence: 2 },
      },
    },
    {
      ...response,
      answers: {
        ...response.answers,
        grade: {
          ...response.answers.grade,
          probabilities: { correct: 1 },
        },
      },
    },
    {
      ...response,
      answers: {
        ...response.answers,
        possible_transcription_issue: { type: "noul", noul: -1 },
      },
    },
    { ...response, answers: { grade: response.answers.grade } },
  ];
  for (const invalid of invalidResponses) {
    assert.equal(jevResponseSchema.safeParse(invalid).success, false);
  }
});
