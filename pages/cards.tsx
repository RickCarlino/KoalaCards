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
import { toEnumOrDefault } from "@/koala/utils/query-params";
import {
  DeckListItem,
  SortBy,
  SortOrder,
  SORT_BY_VALUES,
  SORT_OPTIONS,
  SORT_ORDER_VALUES,
  ORDER_OPTIONS,
  fetchCardsForPage,
  getValidDeckId,
  parseCardsPageQuery,
  type CardRecord,
} from "@/koala/cards/cards-page-helpers";

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

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const dbUser = await getServersideUser(ctx);
  const userId = dbUser?.id;

  if (!userId) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  const parsedQuery = parseCardsPageQuery(ctx.query);
  const decks = await prismaClient.deck.findMany({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const selectedDeckId = getValidDeckId(parsedQuery.deckId, decks);
  const { cards, totalPages, page } = await fetchCardsForPage({
    userId,
    sortBy: parsedQuery.sortBy,
    sortOrder: parsedQuery.sortOrder,
    page: parsedQuery.page,
    q: parsedQuery.q,
    paused: parsedQuery.paused,
    deckId: selectedDeckId,
  });

  return {
    props: {
      cards,
      sortBy: parsedQuery.sortBy,
      sortOrder: parsedQuery.sortOrder,
      page,
      totalPages,
      q: parsedQuery.q,
      paused: parsedQuery.paused,
      deckId: selectedDeckId,
      decks,
    },
  };
};

export default function CardsPage({
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
