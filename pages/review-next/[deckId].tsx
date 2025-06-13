import { getServersideUser } from "@/koala/get-serverside-user";
import MicrophonePermissions from "@/koala/microphone-permissions";
import { prismaClient } from "@/koala/prisma-client";
import { CardReview } from "@/koala/review2";
import { useReview } from "@/koala/review2/reducer";
import {
  Anchor,
  Box,
  Button,
  Container,
  Text,
  Title,
} from "@mantine/core";
import { GetServerSideProps } from "next";
import Link from "next/link";
import React from "react";

export type ReviewDeckPageProps = {
  deckId: number;
  playbackPercentage: number;
};

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

  if (!deck) return redirect("/review");

  // Fetch user settings for audio playback percentage
  const userSettings = await prismaClient.userSettings.findUnique({
    where: { userId: user.id },
    select: { playbackPercentage: true },
  });

  return {
    props: {
      deckId,
      playbackPercentage: userSettings?.playbackPercentage ?? 0.125,
    },
  };
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

const NoMoreQuizzesState = ({
  deckId,
  onReload,
}: {
  deckId: number;
  onReload: () => void;
}) => (
  <Container size="md" py="xl">
    <Box p="md">
      <Title order={3} mb="md">
        No More Quizzes Available
      </Title>
      <Text mb="md">
        You've reviewed all available quizzes for this session. You can:
      </Text>
      <Box mb="lg">
        <Button onClick={onReload} variant="filled" fullWidth mb="xs">
          Continue Lesson (Fetch More Quizzes)
        </Button>
      </Box>
      <Box mb="xs">
        <Anchor component={Link} href={`/cards?deckId=${deckId}`}>
          Add more cards to this deck
        </Anchor>
      </Box>
      <Box mb="xs">
        <Anchor component={Link} href={`/writing/${deckId}`}>
          Practice Writing
        </Anchor>
      </Box>
      <Box>
        <Anchor component={Link} href="/review">
          Go back to deck selection
        </Anchor>
      </Box>
    </Box>
  </Container>
);

function InnerReviewPage({
  deckId,
  playbackPercentage,
}: ReviewDeckPageProps) {
  const {
    state,
    isFetching,
    error,
    currentItem,
    skipCard,
    giveUp,
    onRecordingCaptured,
    completeItem,
    refetchQuizzes,
  } = useReview(deckId, playbackPercentage);

  if (error)
    return <MessageState title="Error">{error.message}</MessageState>;
  if (isFetching)
    return <MessageState title="Loading">Fetching quizzes…</MessageState>;
  if (!currentItem)
    return (
      <NoMoreQuizzesState deckId={deckId} onReload={refetchQuizzes} />
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
          onGiveUp={giveUp}
          onProceed={() => {
            console.log("Trying to proceed...");
            completeItem(currentItem.stepUuid);
            console.log("Proceeding to next item...");
          }}
          recordings={state.recordings}
          currentStepUuid={currentItem.stepUuid}
          onRecordingComplete={(audio: string) => {
            onRecordingCaptured(currentItem.stepUuid, audio);
          }}
        />
      </Box>
    </Container>
  );
}

export default function ReviewDeckPageWrapper(props: ReviewDeckPageProps) {
  return MicrophonePermissions(<InnerReviewPage {...props} />);
}
