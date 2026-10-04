import test from "node:test";
import assert from "node:assert/strict";
import { compareWithSimilarity } from "../koala/quiz-evaluators/evaluator-utils.ts";
import {
  getPassiveReviewCount,
  getPassiveReviewEligibility,
  interleaveEvenly,
  PASSIVE_REVIEW_SIMILARITY,
} from "../koala/review/passive-review.ts";

test("passive review eligibility is scoped to an active card in the current deck", () => {
  assert.deepEqual(getPassiveReviewEligibility("user-1", 42), {
    userId: "user-1",
    deckId: 42,
    paused: false,
    repetitions: { gte: 2 },
  });
});

test("passive review count stays proportional without a cap", () => {
  assert.equal(getPassiveReviewCount(3, 3), 0);
  assert.equal(getPassiveReviewCount(4, 4), 1);
  assert.equal(getPassiveReviewCount(20, 20), 6);
  assert.equal(getPassiveReviewCount(100, 100), 30);
});

test("passive reviews fill a partial hand but not an empty hand", () => {
  assert.equal(getPassiveReviewCount(0, 20), 0);
  assert.equal(getPassiveReviewCount(1, 20), 19);
  assert.equal(getPassiveReviewCount(17, 20), 5);
  assert.equal(getPassiveReviewCount(19, 20), 5);
  assert.equal(getPassiveReviewCount(20, 20), 6);
});

test("passive reviews are distributed through the normal queue", () => {
  assert.deepEqual(
    interleaveEvenly(
      ["a", "b", "c", "d", "e", "f", "g", "h"],
      ["p1", "p2"],
    ),
    ["a", "b", "c", "p1", "d", "e", "p2", "f", "g", "h"],
  );
});

test("passive speech matching accepts sixty percent similarity", () => {
  assert.equal(
    compareWithSimilarity(
      "abcdefghij",
      "abcdefzzzz",
      PASSIVE_REVIEW_SIMILARITY,
    ),
    true,
  );
  assert.equal(
    compareWithSimilarity(
      "abcdefghij",
      "abcdzzzzzz",
      PASSIVE_REVIEW_SIMILARITY,
    ),
    false,
  );
  assert.equal(
    compareWithSimilarity(
      "안녕하세요!",
      "안녕 하세요",
      PASSIVE_REVIEW_SIMILARITY,
    ),
    true,
  );
});
