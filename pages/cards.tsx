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
  createdAt: string; // ISO
  gender: string;
  repetitions: number;
  lapses: number;
  lastReview: number;
  nextReview: number;
};

type EditProps = {
  cards: CardRecord[];
  sortBy: string;
  sortOrder: string;
  page: number;
  totalPages: number;
  q: string;
  paused: boolean;
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

const ITEMS_PER_PAGE = 32;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const dbUser = await getServersideUser(ctx);
  const userId = dbUser?.id;

  if (!userId) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  const { sortBy, sortOrder, page, q, paused } = parseQueryParams(
    ctx.query,
  );
  const { cards, totalPages } = await fetchCards(
    userId,
    sortBy,
    sortOrder,
    page,
    q,
    paused,
  );

  return {
    props: { cards, sortBy, sortOrder, page, totalPages, q, paused },
  };
};

function parseQueryParams(query: Record<string, unknown>) {
  const toStr = (val: unknown): string | undefined =>
    Array.isArray(val) ? val[0] : (val as string | undefined);

  const rawSortBy = toStr(query.sortBy) ?? "createdAt";
  const rawSortOrder = toStr(query.sortOrder) ?? "desc";
  const rawPage = parseInt(toStr(query.page) ?? "", 10);
  const rawQ = toStr(query.q) ?? "";
  const rawPaused = toStr(query.paused) ?? "false";

  const validSortBy = SORT_OPTIONS.map((o) => o.value).includes(rawSortBy)
    ? rawSortBy
    : "createdAt";
  const finalSortOrder = rawSortOrder === "asc" ? "asc" : "desc";
  const finalPage = !isNaN(rawPage) && rawPage > 0 ? rawPage : 1;
  const finalPaused = rawPaused === "true";

  return {
    sortBy: validSortBy,
    sortOrder: finalSortOrder,
    page: finalPage,
    q: rawQ,
    paused: finalPaused,
  };
}

async function fetchCards(
  userId: string,
  sortBy: string,
  sortOrder: string,
  page: number,
  q: string,
  paused: boolean,
) {
  const where = {
    userId,
    ...(paused ? { flagged: true } : {}),
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
}: EditProps) {
  const deleteFlagged = trpc.deletePausedCards.useMutation();
  const router = useRouter();

  const [currentSortBy, setCurrentSortBy] = useState(sortBy);
  const [currentSortOrder, setCurrentSortOrder] = useState(sortOrder);
  const [query, setQuery] = useState(q);
  const [showPaused, setShowPaused] = useState(paused);

  useEffect(() => {
    setCurrentSortBy(sortBy);
    setCurrentSortOrder(sortOrder);
    setQuery(q);
    setShowPaused(paused);
  }, [sortBy, sortOrder, q, paused]);

  const handleDeletePaused = async () => {
    if (confirm("Are you sure you want to delete all paused cards?")) {
      await deleteFlagged.mutateAsync({});
      location.reload();
    }
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    router.push({
      pathname: "/cards",
      query: {
        sortBy: currentSortBy,
        sortOrder: currentSortOrder,
        page: "1",
        q: query,
        paused: String(showPaused),
      },
    });
  };

  const goToPage = (newPage: number) => {
    router.push({
      pathname: "/cards",
      query: {
        sortBy: currentSortBy,
        sortOrder: currentSortOrder,
        page: String(newPage),
        q: query,
        paused: String(showPaused),
      },
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
