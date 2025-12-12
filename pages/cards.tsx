import { GetServerSideProps } from "next";
import { CardTable } from "@/koala/card-table";
import { trpc } from "@/koala/trpc-config";
import { Pager } from "@/koala/components/Pager";
import {
  Button,
  Container,
  Select,
  Group,
  Text,
  TextInput,
  Checkbox,
  Title,
  Paper,
} from "@mantine/core";
import { prismaClient } from "@/koala/prisma-client";
import { useRouter } from "next/router";
import { useState, useEffect, FormEvent } from "react";
import { getServersideUser } from "@/koala/get-serverside-user";
import type { Prisma } from "@prisma/client";
import {
  firstQueryValueFrom,
  toBoolean,
  toEnumOrDefault,
  toPositiveIntOrDefault,
  toPositiveIntOrNull,
} from "@/koala/utils/query-params";

type CardRecord = {
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

type DeckListItem = {
  id: number;
  name: string;
};

type EditProps = {
  cards: CardRecord[];
  sortBy: SortBy;
  sortOrder: SortOrder;
  page: number;
  totalPages: number;
  q: string;
  paused: boolean;
  deckId: number | null;
  decks: DeckListItem[];
};

const SORT_BY_VALUES = [
  "createdAt",
  "lastFailure",
  "definition",
  "flagged",
  "term",
  "nextReview",
  "repetitions",
  "lapses",
] as const;
type SortBy = (typeof SORT_BY_VALUES)[number];

const SORT_ORDER_VALUES = ["asc", "desc"] as const;
type SortOrder = (typeof SORT_ORDER_VALUES)[number];

const SORT_OPTIONS: readonly { label: string; value: SortBy }[] = [
  { label: "Date Created", value: "createdAt" },
  { label: "Date Failed", value: "lastFailure" },
  { label: "Definition", value: "definition" },
  { label: "Paused", value: "flagged" },
  { label: "Term", value: "term" },
  { label: "Next Review", value: "nextReview" },
  { label: "Repetitions", value: "repetitions" },
  { label: "Lapses", value: "lapses" },
];

const ORDER_OPTIONS: readonly { value: SortOrder; label: string }[] = [
  { value: "asc", label: "A -> Z" },
  { value: "desc", label: "Z -> A" },
];

const ITEMS_PER_PAGE = 200;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const dbUser = await getServersideUser(ctx);
  const userId = dbUser?.id;

  if (!userId) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  const parsedQuery = parseQueryParams(ctx.query);
  const decks = await prismaClient.deck.findMany({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const selectedDeckId = getValidDeckId(parsedQuery.deckId, decks);
  const { cards, totalPages } = await fetchCards(
    userId,
    parsedQuery.sortBy,
    parsedQuery.sortOrder,
    parsedQuery.page,
    parsedQuery.q,
    parsedQuery.paused,
    selectedDeckId,
  );

  return {
    props: {
      cards,
      sortBy: parsedQuery.sortBy,
      sortOrder: parsedQuery.sortOrder,
      page: parsedQuery.page,
      totalPages,
      q: parsedQuery.q,
      paused: parsedQuery.paused,
      deckId: selectedDeckId,
      decks,
    },
  };
};

function parseQueryParams(query: Record<string, unknown>): {
  sortBy: SortBy;
  sortOrder: SortOrder;
  page: number;
  q: string;
  paused: boolean;
  deckId: number | null;
} {
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

function getValidDeckId(deckId: number | null, decks: DeckListItem[]) {
  if (deckId === null) {
    return null;
  }

  for (const deck of decks) {
    if (deck.id === deckId) {
      return deckId;
    }
  }
  return null;
}

function buildCardWhere(params: {
  userId: string;
  paused: boolean;
  deckId: number | null;
  q: string;
}): Prisma.CardWhereInput {
  const where: Prisma.CardWhereInput = { userId: params.userId };

  where.flagged = { not: true };
  if (params.paused) {
    where.flagged = true;
  }

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

async function fetchCards(
  userId: string,
  sortBy: SortBy,
  sortOrder: SortOrder,
  page: number,
  q: string,
  paused: boolean,
  deckId: number | null,
) {
  const where = buildCardWhere({ userId, paused, deckId, q });

  const totalCount = await prismaClient.card.count({ where });
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;
  const finalPage = Math.min(Math.max(page, 1), totalPages);

  const cardsData = await prismaClient.card.findMany({
    where,
    orderBy: [orderByFor(sortBy, sortOrder)],
    skip: (finalPage - 1) * ITEMS_PER_PAGE,
    take: ITEMS_PER_PAGE,
  });

  const cards = cardsData.map((c) => ({
    id: c.id,
    flagged: c.flagged,
    term: c.term,
    definition: c.definition,
    createdAt: c.createdAt.toISOString(),
    gender: c.gender,
    repetitions: c.repetitions ?? 0,
    lapses: c.lapses ?? 0,
    lastReview: c.lastReview ?? 0,
    nextReview: c.nextReview ?? 0,
  }));

  return { cards, totalPages };
}

export default function Edit({
  cards,
  sortBy,
  sortOrder,
  page,
  totalPages,
  q,
  paused,
  deckId,
  decks,
}: EditProps) {
  const deleteFlagged = trpc.deletePausedCards.useMutation();
  const router = useRouter();

  const toDeckValue = (value: number | null) =>
    value === null ? "" : String(value);

  const [currentSortBy, setCurrentSortBy] = useState<SortBy>(sortBy);
  const [currentSortOrder, setCurrentSortOrder] =
    useState<SortOrder>(sortOrder);
  const [query, setQuery] = useState(q);
  const [showPaused, setShowPaused] = useState(paused);
  const [selectedDeckId, setSelectedDeckId] = useState(() =>
    toDeckValue(deckId),
  );

  useEffect(() => {
    setCurrentSortBy(sortBy);
    setCurrentSortOrder(sortOrder);
    setQuery(q);
    setShowPaused(paused);
    setSelectedDeckId(toDeckValue(deckId));
  }, [deckId, paused, q, sortBy, sortOrder]);

  const handleDeletePaused = async () => {
    const ok = confirm(
      "Are you sure you want to delete all paused cards?",
    );
    if (!ok) {
      return;
    }
    await deleteFlagged.mutateAsync({});
    location.reload();
  };

  const buildQuery = (pageNumber: number) => {
    const next: Record<string, string> = {
      sortBy: currentSortBy,
      sortOrder: currentSortOrder,
      page: String(pageNumber),
      q: query,
      paused: String(showPaused),
    };

    if (selectedDeckId) {
      next.deckId = selectedDeckId;
    }

    return next;
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    router.push({
      pathname: "/cards",
      query: buildQuery(1),
    });
  };

  const setEnumValue =
    <T extends readonly string[]>(
      values: T,
      fallback: T[number],
      set: (value: T[number]) => void,
    ) =>
    (value: string | null) => {
      if (!value) {
        return;
      }
      set(toEnumOrDefault(value, values, fallback));
    };

  const setSortBy = setEnumValue(
    SORT_BY_VALUES,
    currentSortBy,
    setCurrentSortBy,
  );
  const setSortOrder = setEnumValue(
    SORT_ORDER_VALUES,
    currentSortOrder,
    setCurrentSortOrder,
  );

  const goToPage = (newPage: number) => {
    router.push({
      pathname: "/cards",
      query: buildQuery(newPage),
    });
  };

  const pager = (
    <Pager totalPages={totalPages} page={page} onPage={goToPage} />
  );

  return (
    <Container size="lg" py="lg">
      <Title order={2} mb="sm">
        Your Cards
      </Title>
      <Text c="dimmed" mb="md">
        Browse, search, and manage your cards. Quick-edit or open details.
      </Text>

      <Paper withBorder p="md" radius="md" mb="md">
        <form onSubmit={handleSearch}>
          <Group align="flex-end" wrap="wrap">
            <TextInput
              label="Search"
              placeholder="Find by term or definition"
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              style={{ minWidth: 260 }}
            />
            <Select
              label="Sort By"
              value={currentSortBy}
              onChange={setSortBy}
              data={SORT_OPTIONS}
            />
            <Select
              label="Order"
              value={currentSortOrder}
              onChange={setSortOrder}
              data={ORDER_OPTIONS}
              style={{ width: 140 }}
            />
            <Checkbox
              label="Show paused only"
              checked={showPaused}
              onChange={(e) => setShowPaused(e.currentTarget.checked)}
            />
            <Select
              label="Deck"
              value={selectedDeckId}
              onChange={(value) => setSelectedDeckId(value ?? "")}
              data={[
                { value: "", label: "All decks" },
                ...decks.map((deck) => ({
                  value: String(deck.id),
                  label: deck.name,
                })),
              ]}
              style={{ minWidth: 220 }}
            />
            <Group gap="sm">
              <Button type="submit">Search</Button>
              <Button
                variant="outline"
                color="red"
                onClick={handleDeletePaused}
              >
                Delete Paused Cards
              </Button>
            </Group>
            <Group ml="auto">{pager}</Group>
          </Group>
        </form>
      </Paper>

      <CardTable onDelete={() => undefined} cards={cards} />
      <Group justify="center" mt="md">
        {pager}
      </Group>
    </Container>
  );
}
