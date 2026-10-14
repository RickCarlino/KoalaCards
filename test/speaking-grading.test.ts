import assert from "node:assert/strict";
import test from "node:test";
import {
  gradingPolicy,
  gradeExamples,
  gradeCriteria,
  speakingGrades,
} from "../koala/quiz-evaluators/grading-policy.ts";
import {
  buildSpeakingMessages,
  evaluateSpeakingResponse,
} from "../koala/quiz-evaluators/speaking.ts";
import { speakingInput } from "./speaking-grading-fixtures.ts";

test("speaking grades and feedback always come from the LLM", async () => {
  for (const grade of speakingGrades) {
    let calls = 0;
    const result = await evaluateSpeakingResponse(
      speakingInput,
      async (input) => {
        assert.deepEqual(input, speakingInput);
        calls += 1;
        return { grade, feedback: "  Final feedback.  " };
      },
    );
    assert.equal(calls, 1);
    assert.deepEqual(result, {
      grade,
      feedback:
        grade === "partially_correct"
          ? "Final feedback. (slightly off)"
          : "Final feedback.",
      isCorrect: grade !== "incorrect",
      gradingSource: "openai",
    });
  }
});

test("failed or invalid LLM judgments are errors, never learner failures or false passes", async () => {
  for (const candidate of [
    new Error("OpenAI unavailable"),
    null,
    {},
    { grade: "user_gave_up", feedback: "No" },
    { grade: "other", feedback: "No" },
    { grade: "correct", feedback: " " },
    { grade: "correct" },
  ]) {
    await assert.rejects(
      evaluateSpeakingResponse(speakingInput, async () => {
        if (candidate instanceof Error) {
          throw candidate;
        }
        return candidate;
      }),
    );
  }
});

test("the LLM receives the rubric and only untrusted grading data", () => {
  const input = {
    ...speakingInput,
    deckName: "Sentences",
    deckDescription: "Daily speech",
    userId: "private",
    id: 123,
    expectedGrade: "incorrect",
    isAcceptable: false,
    reason: "old judgment",
  };
  const [system, user] = buildSpeakingMessages(input);
  assert.equal(system.role, "system");
  assert.equal(user.role, "user");
  for (const rule of [
    gradingPolicy,
    gradeExamples,
    ...Object.values(gradeCriteria),
  ]) {
    assert.ok(String(system.content).includes(rule));
  }
  assert.deepEqual(JSON.parse(String(user.content)), {
    ...speakingInput,
    deckName: input.deckName,
    deckDescription: input.deckDescription,
  });
});

test("missing deck context is omitted from LLM grading data", () => {
  for (const absent of [undefined, null, ""]) {
    const [, user] = buildSpeakingMessages({
      ...speakingInput,
      deckName: absent,
      deckDescription: absent,
    });
    assert.deepEqual(JSON.parse(String(user.content)), speakingInput);
  }
});
