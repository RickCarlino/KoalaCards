import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAssistantEditProposal,
  createAssistantStreamParser,
  EDIT_PLACEHOLDER,
  EXAMPLE_PLACEHOLDER,
} from "../koala/review/assistant-parser.ts";

test("createAssistantStreamParser emits placeholders for parsed blocks", () => {
  const parser = createAssistantStreamParser();
  const result = parser.push(
    `hello [[EXAMPLE]]안녕하세요\nHello[[/EXAMPLE]] [[EDIT_CARD]]term: 단어\ndefinition: 뜻[[/EDIT_CARD]]`,
  );

  assert.equal(
    result.textDelta,
    `hello ${EXAMPLE_PLACEHOLDER} ${EDIT_PLACEHOLDER}`,
  );
  assert.deepEqual(result.examples, [
    { phrase: "안녕하세요", translation: "Hello" },
  ]);
  assert.deepEqual(result.edits, [{ term: "단어", definition: "뜻" }]);
});

test("createAssistantStreamParser preserves partial tokens across chunks", () => {
  const parser = createAssistantStreamParser();
  const first = parser.push("intro [[EXAMP");
  const second = parser.push("LE]]문장\nSentence[[/EXAMPLE]]");

  assert.equal(first.textDelta, "intro ");
  assert.deepEqual(first.examples, []);
  assert.equal(second.textDelta, EXAMPLE_PLACEHOLDER);
  assert.deepEqual(second.examples, [
    { phrase: "문장", translation: "Sentence" },
  ]);
});

test("buildAssistantEditProposal merges draft data with the current card", () => {
  const proposal = buildAssistantEditProposal({
    draft: {
      definition: "새 뜻",
      note: "adjust meaning",
    },
    latestCard: {
      cardId: 12,
      term: "원래 단어",
      definition: "원래 뜻",
    },
    createProposalId: (cardId) => `edit-${cardId}`,
  });

  assert.deepEqual(proposal, {
    id: "edit-12",
    cardId: 12,
    term: "원래 단어",
    definition: "새 뜻",
    note: "adjust meaning",
    originalTerm: "원래 단어",
    originalDefinition: "원래 뜻",
  });
});

test("buildAssistantEditProposal returns null when nothing can be edited", () => {
  const proposal = buildAssistantEditProposal({
    draft: {},
    createProposalId: (cardId) => `edit-${cardId}`,
  });

  assert.equal(proposal, null);
});
