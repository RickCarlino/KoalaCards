import { GetServerSideProps } from "next";
import { CardTable } from "@/koala/card-table";
import { trpc } from "@/koala/trpc-config";
import { Button, Container, Select, Group, Text } from "@mantine/core";
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
};

type EditProps = {
  cards: CardRecord[];
  sortBy: string;
  sortOrder: string;
  page: number;
  totalPages: number;
};

const SORT_OPTIONS = [
  { label: "Date Created", value: "createdAt" },
  { label: "Date Failed", value: "lastFailure" },
  { label: "Definition", value: "definition" },
  { label: "Paused", value: "flagged" },
  { label: "Language", value: "langCode" },
  { label: "Term", value: "term" },
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

  const { sortBy, sortOrder, page } = parseQueryParams(ctx.query);
  const { cards, totalPages } = await fetchCards(
    userId,
    sortBy,
    sortOrder,
    page,
  );

  return {
    props: { cards, sortBy, sortOrder, page, totalPages },
  };
};

function parseQueryParams(query: Record<string, unknown>) {
  const toStr = (val: unknown): string | undefined =>
    Array.isArray(val) ? val[0] : (val as string | undefined);

  const rawSortBy = toStr(query.sortBy) ?? "createdAt";
  const rawSortOrder = toStr(query.sortOrder) ?? "desc";
  const rawPage = parseInt(toStr(query.page) ?? "", 10);

  const validSortBy = SORT_OPTIONS.map((o) => o.value).includes(rawSortBy)
    ? rawSortBy
    : "createdAt";
  const finalSortOrder = rawSortOrder === "asc" ? "asc" : "desc";
  const finalPage = !isNaN(rawPage) && rawPage > 0 ? rawPage : 1;

  return {
    sortBy: validSortBy,
    sortOrder: finalSortOrder,
    page: finalPage,
  };
}

async function fetchCards(
  userId: string,
  sortBy: string,
  sortOrder: string,
  page: number,
) {
  const totalCount = await prismaClient.card.count({ where: { userId } });
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;
  const finalPage = Math.min(Math.max(page, 1), totalPages);

  const cardsData = await prismaClient.card.findMany({
    where: { userId },
    orderBy: [{ [sortBy]: sortOrder }],
    skip: (finalPage - 1) * ITEMS_PER_PAGE,
    take: ITEMS_PER_PAGE,
  });

  const cards = cardsData.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }));

  return { cards, totalPages };
}

export default function Edit({
  cards,
  sortBy,
  sortOrder,
  page,
  totalPages,
}: EditProps) {
  const deleteFlagged = trpc.deletePausedCards.useMutation();
  const router = useRouter();

  const [currentSortBy, setCurrentSortBy] = useState(sortBy);
  const [currentSortOrder, setCurrentSortOrder] = useState(sortOrder);

  useEffect(() => {
    setCurrentSortBy(sortBy);
    setCurrentSortOrder(sortOrder);
  }, [sortBy, sortOrder]);

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
    <Container size="s">
      <h1>Manage Cards</h1>

      <form onSubmit={handleSearch}>
        <Group align="flex-end">
          <Select
            label="Sort By"
            value={currentSortBy}
            onChange={(value) => setCurrentSortBy(value!)}
            data={SORT_OPTIONS}
          />
          <Select
            label="Order"
            value={currentSortOrder}
            onChange={(value) => setCurrentSortOrder(value!)}
            data={ORDER_OPTIONS}
          />
          <Button type="submit">Search</Button>
          {Pagination}
          <Button color="red" onClick={handleDeletePaused}>
            Delete Paused Cards
          </Button>
        </Group>
      </form>
      <hr />
      <CardTable onDelete={() => {}} cards={cards} />
      {Pagination}
    </Container>
  );
}
