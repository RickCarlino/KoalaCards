import { getServersideUser } from "@/koala/get-serverside-user";
import { prismaClient } from "@/koala/prisma-client";
import { CardReview } from "@/koala/review2/card-ui";
import { useReview } from "@/koala/review2/logic";
import { Box, Container, Text, Title } from "@mantine/core";
import { GetServerSideProps, GetServerSidePropsResult } from "next";
import { ParsedUrlQuery } from "querystring";

type ReviewDeckPageProps = {
  deckId: number;
};

type ServerSideResult = GetServerSidePropsResult<ReviewDeckPageProps | {}>;

const handleNumericDeckId = async (
  id: number,
  userId: string,
): Promise<ServerSideResult> => {
  const deck = await prismaClient.deck.findUnique({
    where: { userId, id },
    select: { userId: true },
  });

  if (!deck) {
    return { redirect: { destination: "/review", permanent: false } };
  }

  return { props: { deckId: id } };
};

export const getServerSideProps: GetServerSideProps<
  ReviewDeckPageProps | {}
> = async (context) => {
  const dbUser = await getServersideUser(context);

  if (!dbUser) {
    return {
      redirect: { destination: "/api/auth/signin", permanent: false },
    };
  }

  const { deckId: deckIdParam } = context.params as ParsedUrlQuery;

  if (!deckIdParam || typeof deckIdParam !== "string") {
    return { redirect: { destination: "/review", permanent: false } };
  }

  return handleNumericDeckId(parseInt(deckIdParam, 10), dbUser.id);
};

const LoadingState = () => (
  <Container size="md" py="xl">
    <Box p="md">
      <Title order={3} mb="md">
        Loading
      </Title>
      <Text>
        Fetching Quizzes. This could take a while for new cards...
      </Text>
    </Box>
  </Container>
);

const ErrorState = ({ message }: { message: string }) => (
  <Container size="md" py="xl">
    <Box p="md">
      <Title order={3} mb="md">
        Error
      </Title>
      <Text>{message}</Text>
    </Box>
  </Container>
);

const NoQuizzesState = (_: { deckId: number }) => (
  <Container size="md" py="xl">
    <Box p="md">
      <Title order={3} mb="md">
        No More Quizzes Available
      </Title>
      <Text mb="md">
        You've reviewed all available quizzes for this session. You can:
      </Text>
    </Box>
  </Container>
);

export default function ReviewNext({ deckId }: ReviewDeckPageProps) {
  const { state, isFetching, error, currentItem, skipCard } =
    useReview(deckId);

  if (error) {
    return <ErrorState message={error.message || ""} />;
  }

  if (isFetching) {
    return <LoadingState />;
  }

  if (!currentItem) {
    return <NoQuizzesState deckId={deckId} />;
  }

  const { cardUUID, itemType } = currentItem;

  const card = state.cards[cardUUID];

  if (!card) {
    return <div>No cards... Hmm....</div>;
  }

  return (
    <Container size="xl" py="md">
      <Box p="md">
        <CardReview
          card={card}
          itemType={itemType}
          itemsComplete={state.itemsComplete}
          totalItems={state.totalItems}
          onSkip={(uuid: string) => {
            skipCard(uuid);
          }}
          onProceed={() => {
            // Logic to proceed to the next card
          }}
        />
      </Box>
    </Container>
  );
}
