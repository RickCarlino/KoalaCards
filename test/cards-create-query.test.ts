import test from "node:test";
import assert from "node:assert/strict";
import { parseCardsQueryParams } from "../koala/cards/query-params.ts";
import { parseCreatePageRoute } from "../koala/create-page-query.ts";

test("parseCardsQueryParams applies defaults and validates values", () => {
  const parsed = parseCardsQueryParams(
    {
      sortBy: "invalid",
      sortOrder: "sideways",
      page: "-2",
      q: ["search term"],
      paused: "true",
      deck_id: "42",
    },
    {
      allowedSortValues: ["createdAt", "definition"],
      defaultSortBy: "createdAt",
      defaultSortOrder: "desc",
      defaultPage: 1,
    },
  );

  assert.deepEqual(parsed, {
    sortBy: "createdAt",
    sortOrder: "desc",
    page: 1,
    q: "search term",
    paused: true,
    deckId: 42,
  });
});

test("parseCardsQueryParams preserves valid sort and page values", () => {
  const parsed = parseCardsQueryParams(
    {
      sortBy: "definition",
      sortOrder: "asc",
      page: "3",
      q: " deck ",
      deckId: "7",
    },
    {
      allowedSortValues: ["createdAt", "definition"],
      defaultSortBy: "createdAt",
      defaultSortOrder: "desc",
      defaultPage: 1,
    },
  );

  assert.deepEqual(parsed, {
    sortBy: "definition",
    sortOrder: "asc",
    page: 3,
    q: " deck ",
    paused: false,
    deckId: 7,
  });
});

test("parseCreatePageRoute resolves mode, deck, and comma-separated words", () => {
  const parsed = parseCreatePageRoute(
    {
      mode: "csv",
      deck_id: "2",
      words: encodeURIComponent("사과, 배,  감 "),
    },
    [
      { id: 1, name: "Alpha", langCode: "ko" },
      { id: 2, name: "Beta", langCode: "ja" },
    ],
  );

  assert.deepEqual(parsed, {
    mode: "csv",
    selectedDeck: { id: 2, name: "Beta", langCode: "ja" },
    words: ["사과", "배", "감"],
  });
});

test("parseCreatePageRoute ignores invalid mode and unknown deck", () => {
  const parsed = parseCreatePageRoute(
    {
      mode: "other",
      deckId: "999",
    },
    [{ id: 1, name: "Alpha", langCode: "ko" }],
  );

  assert.deepEqual(parsed, {
    mode: null,
    selectedDeck: null,
    words: [],
  });
});
