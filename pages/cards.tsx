import { GetServerSideProps } from "next";
import { CardTable } from "@/koala/card-table";
import { trpc } from "@/koala/trpc-config";
import { Button, Container, Select, Group } from "@mantine/core";
import { prismaClient } from "@/koala/prisma-client";
import { getSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";

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
};

const SORT_OPTIONS = [
  { label: "Date Created", value: "createdAt" },
  { label: "Definition", value: "definition" },
  { label: "Flag Status", value: "flagged" },
  { label: "Language", value: "langCode" },
  { label: "Term", value: "term" },
];

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx);

  if (!session || !session.user) {
    return { redirect: { destination: "/api/auth/signin", permanent: false } };
  }

  const dbUser = await prismaClient.user.findUnique({
    where: { email: session.user.email ?? undefined },
  });

  const userId = dbUser?.id;

  // Extract and normalize query parameters
  const rawSortBy = Array.isArray(ctx.query.sortBy)
    ? ctx.query.sortBy[0]
    : ctx.query.sortBy;
  const rawSortOrder = Array.isArray(ctx.query.sortOrder)
    ? ctx.query.sortOrder[0]
    : ctx.query.sortOrder;

  const sortBy = rawSortBy ?? "createdAt";
  const sortOrder = rawSortOrder ?? "desc";

  // Validate the sortBy field (optional)
  const validFields = SORT_OPTIONS.map((x) => x.value);
  const finalSortBy = validFields.includes(sortBy) ? sortBy : "createdAt";
  const finalSortOrder = sortOrder === "desc" ? "desc" : "asc";

  const cards = await prismaClient.card.findMany({
    where: { userId },
    orderBy: [{ [finalSortBy]: finalSortOrder }],
  });

  const serializedCards = cards.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }));

  return {
    props: {
      cards: serializedCards,
      sortBy: finalSortBy,
      sortOrder: finalSortOrder,
    },
  };
};

const Edit: React.FC<EditProps> = ({ cards, sortBy, sortOrder }) => {
  const deleteFlagged = trpc.deleteFlaggedCards.useMutation();
  const router = useRouter();

  const [currentSortBy, setCurrentSortBy] = useState(sortBy);
  const [currentSortOrder, setCurrentSortOrder] = useState(sortOrder);

  useEffect(() => {
    setCurrentSortBy(sortBy);
    setCurrentSortOrder(sortOrder);
  }, [sortBy, sortOrder]);

  const doDeleteFlagged = () => {
    const warning = "Are you sure you want to delete all flagged cards?";
    if (!confirm(warning)) return;
    deleteFlagged.mutateAsync({}).then(() => location.reload());
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Build the URL with query parameters
    const query = { sortBy: currentSortBy, sortOrder: currentSortOrder };
    router.push({ pathname: "/cards", query });
  };

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
            data={[
              { value: "asc", label: "A -> Z" },
              { value: "desc", label: "Z -> A" },
            ]}
          />
          <Button type="submit">Search</Button>
          <Button color="red" onClick={doDeleteFlagged} mt="md">
            Delete Flagged Cards
          </Button>
        </Group>
      </form>
      <hr />
      <CardTable onDelete={() => location.reload()} cards={cards} />
    </Container>
  );
};

export default Edit;
