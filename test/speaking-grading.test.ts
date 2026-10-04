import assert from "node:assert/strict";
import test from "node:test";
import {
  gradingPolicy,
  gradeExamples,
  gradeCriteria,
} from "../koala/quiz-evaluators/grading-policy.ts";
import { jevGrades, jevQuestions } from "../koala/quiz-evaluators/jev.ts";
import {
  buildSpeakingMessages,
  CONFIDENCE_CUTTOFF,
  evaluateSpeakingResponse,
} from "../koala/quiz-evaluators/speaking.ts";
import { jevResponse, speakingInput } from "./jev-fixtures.ts";

test("speaking cutoff is 85 percent and only confident correct/give-up skip GPT", async () => {
  assert.equal(CONFIDENCE_CUTTOFF, 0.85);
  for (const choice of jevGrades) {
    for (const confidence of [0.3, 0.85, 0.850001, 1]) {
      const calls: string[] = [];
      const result = await evaluateSpeakingResponse(speakingInput, {
        jev: async (input) => {
          assert.deepEqual(input, speakingInput);
          calls.push("jev");
          return jevResponse(choice, confidence);
        },
        openai: async (input) => {
          assert.deepEqual(input, speakingInput);
          calls.push("openai");
          return {
            grade: "partially_correct",
            feedback: "A small correction.",
          };
        },
      });
      const skipsGpt =
        confidence > 0.85 && ["correct", "user_gave_up"].includes(choice);
      assert.deepEqual(
        calls,
        skipsGpt ? ["jev"] : ["jev", "openai"],
        `${choice} at ${confidence}`,
      );
      assert.equal(result.gradingSource, skipsGpt ? "jev" : "openai");
      assert.equal(result.jevGrade, choice);
      assert.equal(result.jevConfidence, confidence);
      if (skipsGpt) {
        assert.equal(
          result.grade,
          choice === "correct" ? "correct" : "incorrect",
        );
        assert.equal(result.isCorrect, choice === "correct");
      } else {
        assert.equal(result.grade, "partially_correct");
        assert.equal(result.isCorrect, true);
        assert.equal(result.feedback, "A small correction. (very close)");
      }
    }
  }
});

test("GPT makes the final decision independently of the JEV grade", async () => {
  for (const grade of [
    "correct",
    "partially_correct",
    "incorrect",
  ] as const) {
    const result = await evaluateSpeakingResponse(speakingInput, {
      jev: async () => jevResponse("incorrect", 1),
      openai: async () => ({ grade, feedback: "Final feedback." }),
    });
    assert.equal(result.grade, grade);
    assert.equal(result.isCorrect, grade !== "incorrect");
  }
});

test("unavailable or malformed JEV responses fall back without fabricating a JEV judgment", async () => {
  for (const candidate of [
    null,
    {},
    {
      ...jevResponse(),
      answers: { grade: { choice: "correct", confidence: 2 } },
    },
    new Error("Provider unavailable"),
  ]) {
    let gptCalls = 0;
    const result = await evaluateSpeakingResponse(speakingInput, {
      jev: async () => {
        if (candidate instanceof Error) {
          throw candidate;
        }
        return candidate;
      },
      openai: async () => {
        gptCalls += 1;
        return { grade: "correct", feedback: "Correct!" };
      },
    });
    assert.equal(gptCalls, 1);
    assert.equal(result.gradingSource, "openai");
    assert.equal(result.jevGrade, null);
    assert.equal(result.jevConfidence, null);
  }
});

test("failed or invalid GPT judgments are errors, never learner failures or false passes", async () => {
  for (const candidate of [
    new Error("OpenAI unavailable"),
    { grade: "user_gave_up", feedback: "No" },
    { grade: "correct", feedback: " " },
  ]) {
    await assert.rejects(
      evaluateSpeakingResponse(speakingInput, {
        jev: async () => jevResponse("other", 0.9),
        openai: async () => {
          if (candidate instanceof Error) {
            throw candidate;
          }
          return candidate;
        },
      }),
    );
  }
});

test("GPT and JEV share the rubric and GPT receives only untrusted grading data", () => {
  const input = {
    ...speakingInput,
    deckName: "Sentences",
    deckDescription: "Daily speech",
    userId: "private",
    id: 123,
    expectedGrade: "incorrect",
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
  assert.ok(jevQuestions.grade.instructions.includes(gradingPolicy));
  assert.deepEqual(jevQuestions.grade.criteria, gradeCriteria);
  assert.deepEqual(JSON.parse(String(user.content)), {
    ...speakingInput,
    deckName: input.deckName,
    deckDescription: input.deckDescription,
  });
});
