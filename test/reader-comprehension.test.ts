import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFallbackKoreanQuestions,
  mergeQuestionLists,
  normalizeKoreanQuestion,
} from "../koala/reader/comprehension-questions.ts";

test("normalizeKoreanQuestion strips numbering and normalizes punctuation", () => {
  assert.equal(
    normalizeKoreanQuestion(" 2)  이 글의 핵심은 무엇인가요？ "),
    "이 글의 핵심은 무엇인가요?",
  );
});

test("normalizeKoreanQuestion rejects empty and latin text", () => {
  assert.equal(normalizeKoreanQuestion(""), "");
  assert.equal(normalizeKoreanQuestion("What is the point?"), "");
});

test("buildFallbackKoreanQuestions normalizes and fills blanks", () => {
  const questions = buildFallbackKoreanQuestions(3, [
    "1. 이 글의 핵심은 무엇인가요",
    "",
  ]);

  assert.deepEqual(questions, [
    "이 글의 핵심은 무엇인가요?",
    "이 글의 핵심 내용은 무엇인가요?",
    "이 글의 핵심은 무엇인가요?",
  ]);
});

test("mergeQuestionLists keeps unique normalized questions and backfills", () => {
  const merged = mergeQuestionLists({
    preferredQuestions: [
      "1. 이 글의 핵심은 무엇인가요",
      "이 글의 핵심은 무엇인가요?",
      "What happened?",
    ],
    fallbackQuestions: [
      "글쓴이가 강조한 내용은 무엇인가요",
      "이 글의 핵심은 무엇인가요?",
    ],
    questionCount: 3,
  });

  assert.deepEqual(merged, [
    "이 글의 핵심은 무엇인가요?",
    "글쓴이가 강조한 내용은 무엇인가요?",
    "글쓴이가 강조한 내용은 무엇인가요?",
  ]);
});
