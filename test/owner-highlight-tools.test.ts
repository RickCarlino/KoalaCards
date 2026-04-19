import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExplainSelectionPayload,
  canExplainSelection,
  findExplainedHighlightMatch,
  hasExplainSelectionStream,
  resolveExplainSelectionErrorMessage,
} from "../koala/reader/owner-highlight-tools.ts";

test("owner highlight helpers build the explain payload", () => {
  assert.deepEqual(
    buildExplainSelectionPayload("article-1", {
      selectedText: "단어",
      contextBefore: "앞",
      contextAfter: "뒤",
      occurrenceHint: 2,
    }),
    {
      publicId: "article-1",
      selectedText: "단어",
      contextBefore: "앞",
      contextAfter: "뒤",
      occurrenceHint: 2,
    },
  );
});

test("owner highlight helpers resolve explained highlight matches", () => {
  const highlights = [{ id: 1 }, { id: 2 }];
  const match = findExplainedHighlightMatch(
    highlights,
    {
      selectedText: "단어",
      contextBefore: "앞",
      contextAfter: "뒤",
      occurrenceHint: 0,
    },
    () => 2,
  );

  assert.deepEqual(match, {
    matchedHighlightId: 2,
    matchedHighlight: { id: 2 },
  });
});

test("owner highlight helpers normalize explain errors", () => {
  assert.equal(
    resolveExplainSelectionErrorMessage(new Error("boom"), false),
    "boom",
  );
  assert.equal(
    resolveExplainSelectionErrorMessage("boom", false),
    "Unable to stream explanation.",
  );
  assert.equal(
    resolveExplainSelectionErrorMessage(new Error("boom"), true),
    null,
  );
});

test("owner highlight helpers gate explain requests and validate streams", () => {
  assert.equal(
    canExplainSelection(
      {
        selectedText: "단어",
        contextBefore: "앞",
        contextAfter: "뒤",
        occurrenceHint: 0,
      },
      false,
    ),
    true,
  );
  assert.equal(canExplainSelection(null, false), false);

  const okResponse = new Response("ok");
  Object.defineProperty(okResponse, "body", {
    value: new ReadableStream(),
  });
  assert.equal(hasExplainSelectionStream(okResponse), true);
  assert.equal(
    hasExplainSelectionStream(new Response("bad", { status: 500 })),
    false,
  );
});
