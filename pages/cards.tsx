import { GetServerSideProps } from "next";
import { CardTable } from "@/koala/card-table";
import { trpc } from "@/koala/trpc-config";
import { Button, Container } from "@mantine/core";
import { prismaClient } from "@/koala/prisma-client";
import { getSession } from "next-auth/react";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx);

  if (!session || !session.user) {
    return { redirect: { destination: "/api/auth/signin", permanent: false } };
  }

  const dbUser = await prismaClient.user.findUnique({
    where: {
      email: session.user.email ?? undefined,
    },
  });

  const userId = dbUser?.id;

  const cards = await prismaClient.card.findMany({
    where: { userId },
    orderBy: [{ flagged: "desc" }, { createdAt: "asc" }],
  });
  const serializedCards = cards.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }));

  return { props: { cards: serializedCards } };
};
type EditComponent = React.FC<{
  cards: {
    id: number;
    flagged: boolean;
    term: string;
    definition: string;
  }[];
}>;

const Edit: EditComponent = ({ cards }) => {
  const deleteFlagged = trpc.deleteFlaggedCards.useMutation();
  const doDeleteFlagged = () => {
    const warning = "Are you sure you want to delete all flagged cards?";
    if (!confirm(warning)) return;
    deleteFlagged.mutateAsync({}).then(() => location.reload());
  };

  return (
    <Container size="s">
      <h1>Manage Cards</h1>
      <Button onClick={doDeleteFlagged}>Delete Flagged Cards</Button>
      <hr />
      <CardTable onDelete={() => location.reload()} cards={cards} />
    </Container>
  );
};

export default Edit;
