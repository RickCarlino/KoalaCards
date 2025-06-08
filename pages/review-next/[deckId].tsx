import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { CardReview } from "@/koala/review2";
import { useReview } from "@/koala/review2/reducer";
import { Box, Container, Text, Title } from "@mantine/core";
import { GetServerSideProps } from "next";
import React from "react";

export type ReviewDeckPageProps = { deckId: number };

const redirect = (destination: string) => ({
  redirect: { destination, permanent: false } as const,
});

export const getServerSideProps: GetServerSideProps<
  ReviewDeckPageProps
> = async (ctx) => {
  const user = await getServersideUser(ctx);
  if (!user) return redirect("/api/auth/signin");

  const deckId = Number(ctx.params?.deckId);
  if (!deckId) return redirect("/review");

  const deck = await prismaClient.deck.findUnique({
    where: { userId: user.id, id: deckId },
    select: { id: true },
  });

  return deck ? { props: { deckId } } : redirect("/review");
};

const MessageState = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <Container size="md" py="xl">
    <Box p="md">
      <Title order={3} mb="md">
        {title}
      </Title>
      <Text>{children}</Text>
    </Box>
  </Container>
);

export default function ReviewDeckPage({ deckId }: ReviewDeckPageProps) {
  const { state, isFetching, error, currentItem, skipCard, onRecordingCaptured } =
    useReview(deckId);

  if (error)
    return <MessageState title="Error">{error.message}</MessageState>;
  if (isFetching)
    return <MessageState title="Loading">Fetching quizzes…</MessageState>;
  if (!currentItem)
    return (
      <MessageState title="No More Quizzes">
        All done for now!
      </MessageState>
    );

  const card = state.cards[currentItem.cardUUID];
  if (!card)
    return <MessageState title="Oops">No card data.</MessageState>;

  return (
    <Container size="xl" py="md">
      <Box p="md">
        <CardReview
          card={card}
          itemType={currentItem.itemType}
          itemsComplete={state.itemsComplete}
          totalItems={state.totalItems}
          onSkip={skipCard}
          onProceed={() => {}}
          recordings={state.recordings}
          currentStepUuid={card.uuid}
          onRecordingComplete={(audio: string) => {
            onRecordingCaptured(card.uuid, audio);
          }}
        />
      </Box>
    </Container>
  );
}
