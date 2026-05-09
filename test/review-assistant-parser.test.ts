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

test("createAssistantStreamParser handles fallback edits and malformed blocks", () => {
  const parser = createAssistantStreamParser();

  assert.deepEqual(
    parser.push("[[EDIT_CARD]]새 단어\n새 뜻[[/EDIT_CARD]]"),
    {
      textDelta: EDIT_PLACEHOLDER,
      examples: [],
      edits: [{ term: "새 단어", definition: "새 뜻" }],
    },
  );

  assert.deepEqual(
    parser.push(
      "[[EDIT_CARD]]id: 99\nreason: better wording[[/EDIT_CARD]]",
    ),
    {
      textDelta: EDIT_PLACEHOLDER,
      examples: [],
      edits: [{ cardId: 99, note: "better wording" }],
    },
  );

  assert.deepEqual(parser.push("[[EXAMPLE]]only one line[[/EXAMPLE]]"), {
    textDelta: "only one line",
    examples: [],
    edits: [],
  });

  parser.push("[[EXAMPLE]]문장");
  assert.deepEqual(parser.flush(), {
    textDelta: "",
    examples: [],
    edits: [],
  });
});

test("createAssistantStreamParser flushes ordinary buffered text", () => {
  const parser = createAssistantStreamParser();
  assert.deepEqual(parser.push("hello [[EX"), {
    textDelta: "hello ",
    examples: [],
    edits: [],
  });
  assert.deepEqual(parser.flush(), {
    textDelta: "[[EX",
    examples: [],
    edits: [],
  });
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

test("buildAssistantEditProposal supports explicit card ids without latest card", () => {
  const proposal = buildAssistantEditProposal({
    draft: {
      cardId: 44,
      term: "새 단어",
    },
    latestCard: {
      cardId: 12,
      term: "원래 단어",
      definition: "원래 뜻",
    },
    createProposalId: (cardId) => `edit-${cardId}`,
  });

  assert.deepEqual(proposal, {
    id: "edit-44",
    cardId: 44,
    term: "새 단어",
    definition: "",
    note: undefined,
    originalTerm: undefined,
    originalDefinition: undefined,
  });
});
