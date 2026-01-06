import { GetServerSideProps } from "next";
import { CardTable } from "@/koala/card-table";
import { trpc } from "@/koala/trpc-config";
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
  sortBy: string;
  sortOrder: string;
  page: number;
  totalPages: number;
  q: string;
  paused: boolean;
  deckId: number | null;
  decks: DeckListItem[];
};

const SORT_OPTIONS = [
  { label: "Date Created", value: "createdAt" },
  { label: "Date Failed", value: "lastFailure" },
  { label: "Definition", value: "definition" },
  { label: "Paused", value: "flagged" },
  { label: "Term", value: "term" },
  { label: "Next Review", value: "nextReview" },
  { label: "Repetitions", value: "repetitions" },
  { label: "Lapses", value: "lapses" },
];

const ORDER_OPTIONS = [
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

function parseQueryParams(query: Record<string, unknown>) {
  const toStr = (val: unknown): string | undefined => {
    if (typeof val === "string") {
      return val;
    }
    if (Array.isArray(val)) {
      return val[0];
    }
    return undefined;
  };

  const rawSortBy = toStr(query.sortBy) ?? "createdAt";
  const rawSortOrder = toStr(query.sortOrder) ?? "desc";
  const rawPage = parseInt(toStr(query.page) ?? "", 10);
  const rawQ = toStr(query.q) ?? "";
  const rawPaused = toStr(query.paused) ?? "false";
  const rawDeckId = parseInt(
    toStr(query.deckId) ?? toStr(query.deck_id) ?? "",
    10,
  );

  const validSortBy = SORT_OPTIONS.map((o) => o.value).includes(rawSortBy)
    ? rawSortBy
    : "createdAt";
  const finalSortOrder = rawSortOrder === "asc" ? "asc" : "desc";
  const finalPage = !isNaN(rawPage) && rawPage > 0 ? rawPage : 1;
  const finalPaused = rawPaused === "true";
  const deckId =
    Number.isFinite(rawDeckId) && rawDeckId > 0 ? rawDeckId : null;

  return {
    sortBy: validSortBy,
    sortOrder: finalSortOrder,
    page: finalPage,
    q: rawQ,
    paused: finalPaused,
    deckId,
  };
}

function getValidDeckId(deckId: number | null, decks: DeckListItem[]) {
  if (deckId === null) {
    return null;
  }

  return decks.some((deck) => deck.id === deckId) ? deckId : null;
}

async function fetchCards(
  userId: string,
  sortBy: string,
  sortOrder: string,
  page: number,
  q: string,
  paused: boolean,
  deckId: number | null,
) {
  const where = {
    userId,
    ...(paused ? { flagged: true } : {}),
    ...(deckId !== null ? { deckId } : {}),
    ...(q
      ? {
          OR: [
            { term: { contains: q, mode: "insensitive" as const } },
            { definition: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const totalCount = await prismaClient.card.count({ where });
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;
  const finalPage = Math.min(Math.max(page, 1), totalPages);

  const cardsData = await prismaClient.card.findMany({
    where,
    orderBy: [{ [sortBy]: sortOrder }],
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

  const [currentSortBy, setCurrentSortBy] = useState(sortBy);
  const [currentSortOrder, setCurrentSortOrder] = useState(sortOrder);
  const [query, setQuery] = useState(q);
  const [showPaused, setShowPaused] = useState(paused);
  const [selectedDeckId, setSelectedDeckId] = useState(
    deckId ? String(deckId) : "",
  );

  useEffect(() => {
    setCurrentSortBy(sortBy);
    setCurrentSortOrder(sortOrder);
    setQuery(q);
    setShowPaused(paused);
    setSelectedDeckId(deckId ? String(deckId) : "");
  }, [deckId, paused, q, sortBy, sortOrder]);

  const handleDeletePaused = async () => {
    if (confirm("Are you sure you want to delete all paused cards?")) {
      await deleteFlagged.mutateAsync({});
      location.reload();
    }
  };

  const buildQuery = (pageNumber: number) => ({
    sortBy: currentSortBy,
    sortOrder: currentSortOrder,
    page: String(pageNumber),
    q: query,
    paused: String(showPaused),
    ...(selectedDeckId ? { deckId: selectedDeckId } : {}),
  });

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    router.push({
      pathname: "/cards",
      query: buildQuery(1),
    });
  };

  const goToPage = (newPage: number) => {
    router.push({
      pathname: "/cards",
      query: buildQuery(newPage),
    });
  };

  const Pagination = totalPages > 1 && (
    <Group mt="md">
      <Button disabled={page <= 1} onClick={() => goToPage(page - 1)}>
        Previous
      </Button>
      <Text>
        Page {page} of {totalPages}
      </Text>
      <Button
        disabled={page >= totalPages}
        onClick={() => goToPage(page + 1)}
      >
        Next
      </Button>
    </Group>
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
              onChange={(value) => value && setCurrentSortBy(value)}
              data={SORT_OPTIONS}
            />
            <Select
              label="Order"
              value={currentSortOrder}
              onChange={(value) => value && setCurrentSortOrder(value)}
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
            <Group ml="auto">{Pagination}</Group>
          </Group>
        </form>
      </Paper>

      <CardTable onDelete={() => undefined} cards={cards} />
      {Pagination}
    </Container>
  );
}
