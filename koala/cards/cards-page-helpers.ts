import type { Prisma } from "@prisma/client";
import {
  firstQueryValueFrom,
  toBoolean,
  toEnumOrDefault,
  toPositiveIntOrDefault,
  toPositiveIntOrNull,
} from "@/koala/utils/query-params";
import { prismaClient } from "@/koala/prisma-client";

export type CardRecord = {
  id: number;
  flagged: boolean;
  term: string;
  definition: string;
  createdAt: string;
  gender: string;
  repetitions: number;
  lapses: number;
  lastReview: number;
  nextReview: number;
};

export type DeckListItem = {
  id: number;
  name: string;
};

export const SORT_BY_VALUES = [
  "createdAt",
  "lastFailure",
  "definition",
  "flagged",
  "term",
  "nextReview",
  "repetitions",
  "lapses",
] as const;
export type SortBy = (typeof SORT_BY_VALUES)[number];

export const SORT_ORDER_VALUES = ["asc", "desc"] as const;
export type SortOrder = (typeof SORT_ORDER_VALUES)[number];

export const SORT_OPTIONS: readonly { label: string; value: SortBy }[] = [
  { label: "Date Created", value: "createdAt" },
  { label: "Date Failed", value: "lastFailure" },
  { label: "Definition", value: "definition" },
  { label: "Paused", value: "flagged" },
  { label: "Term", value: "term" },
  { label: "Next Review", value: "nextReview" },
  { label: "Repetitions", value: "repetitions" },
  { label: "Lapses", value: "lapses" },
];

export const ORDER_OPTIONS: readonly {
  value: SortOrder;
  label: string;
}[] = [
  { value: "asc", label: "A -> Z" },
  { value: "desc", label: "Z -> A" },
];

const ITEMS_PER_PAGE = 200;

export type CardsPageQuery = {
  sortBy: SortBy;
  sortOrder: SortOrder;
  page: number;
  q: string;
  paused: boolean;
  deckId: number | null;
};

export function parseCardsPageQuery(
  query: Record<string, unknown>,
): CardsPageQuery {
  const sortBy = toEnumOrDefault(
    firstQueryValueFrom(query, "sortBy"),
    SORT_BY_VALUES,
    "createdAt",
  );
  const sortOrder = toEnumOrDefault(
    firstQueryValueFrom(query, "sortOrder"),
    SORT_ORDER_VALUES,
    "desc",
  );
  const page = toPositiveIntOrDefault(
    firstQueryValueFrom(query, "page"),
    1,
  );
  const q = firstQueryValueFrom(query, "q") ?? "";
  const paused = toBoolean(firstQueryValueFrom(query, "paused"));
  const deckId = toPositiveIntOrNull(
    firstQueryValueFrom(query, "deckId", "deck_id"),
  );

  return { sortBy, sortOrder, page, q, paused, deckId };
}

export function getValidDeckId(
  deckId: number | null,
  decks: DeckListItem[],
): number | null {
  if (deckId === null) {
    return null;
  }
  return decks.some((deck) => deck.id === deckId) ? deckId : null;
}

function flaggedFilter(pausedOnly: boolean) {
  if (pausedOnly) {
    return true;
  }
  return { not: true } satisfies Prisma.BoolFilter;
}

function buildCardWhere(params: {
  userId: string;
  paused: boolean;
  deckId: number | null;
  q: string;
}): Prisma.CardWhereInput {
  const where: Prisma.CardWhereInput = {
    userId: params.userId,
    flagged: flaggedFilter(params.paused),
  };

  if (params.deckId !== null) {
    where.deckId = params.deckId;
  }

  const query = params.q.trim();
  if (query.length > 0) {
    where.OR = [
      { term: { contains: query, mode: "insensitive" } },
      { definition: { contains: query, mode: "insensitive" } },
    ];
  }

  return where;
}

function orderByFor(
  sortBy: SortBy,
  sortOrder: SortOrder,
): Prisma.CardOrderByWithRelationInput {
  switch (sortBy) {
    case "createdAt":
      return { createdAt: sortOrder };
    case "lastFailure":
      return { lastFailure: sortOrder };
    case "definition":
      return { definition: sortOrder };
    case "flagged":
      return { flagged: sortOrder };
    case "term":
      return { term: sortOrder };
    case "nextReview":
      return { nextReview: sortOrder };
    case "repetitions":
      return { repetitions: sortOrder };
    case "lapses":
      return { lapses: sortOrder };
  }
}

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(page, 1), totalPages);
}

export async function fetchCardsForPage(params: {
  userId: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
  page: number;
  q: string;
  paused: boolean;
  deckId: number | null;
}): Promise<{ cards: CardRecord[]; totalPages: number; page: number }> {
  const where = buildCardWhere(params);

  const totalCount = await prismaClient.card.count({ where });
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;
  const page = clampPage(params.page, totalPages);

  const cardsData = await prismaClient.card.findMany({
    where,
    orderBy: [orderByFor(params.sortBy, params.sortOrder)],
    skip: (page - 1) * ITEMS_PER_PAGE,
    take: ITEMS_PER_PAGE,
  });

  const cards = cardsData.map((card) => ({
    id: card.id,
    flagged: card.flagged,
    term: card.term,
    definition: card.definition,
    createdAt: card.createdAt.toISOString(),
    gender: card.gender,
    repetitions: card.repetitions ?? 0,
    lapses: card.lapses ?? 0,
    lastReview: card.lastReview ?? 0,
    nextReview: card.nextReview ?? 0,
  }));

  return { cards, totalPages, page };
}
