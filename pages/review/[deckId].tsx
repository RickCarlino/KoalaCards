import { getServersideUser } from "@/koala/get-serverside-user";
import MicrophonePermissions from "@/koala/microphone-permissions";
import { prismaClient } from "@/koala/prisma-client";
import { CardReview } from "@/koala/review";
import { HOTKEYS } from "@/koala/review/hotkeys";
import { useReview } from "@/koala/review/reducer";
import {
  Anchor,
  Box,
  Button,
  Container,
  Text,
  Title,
} from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { GetServerSideProps } from "next";
import Link from "next/link";
import React from "react";

type ReviewDeckPageProps = {
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
  if (!user) {
    return redirect("/api/auth/signin");
  }

  const deckId = Number(ctx.params?.deckId);
  if (!deckId) {
    return redirect("/review");
  }

  const deck = await prismaClient.deck.findUnique({
    where: { userId: user.id, id: deckId },
    select: { id: true },
  });

  if (!deck) {
    return redirect("/review");
  }

  const userSettings = await prismaClient.userSettings.findUnique({
    where: { userId: user.id },
  });

  if (!userSettings) {
    return redirect("/settings");
  }

  if (userSettings.writingFirst) {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    // Get user's writing progress in the last 24 hours
    const writingProgress = await prismaClient.writingSubmission.aggregate(
      {
        _sum: { correctionCharacterCount: true },
        where: {
          userId: user.id,
          createdAt: { gte: last24Hours },
        },
      },
    );

    const progress = writingProgress._sum.correctionCharacterCount ?? 0;
    const goal = userSettings.dailyWritingGoal ?? 100;
    if (progress < goal) {
      return {
        redirect: {
          destination: `/writing/${deckId}`,
          permanent: false,
        },
      };
    }
  }

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
}) => {
  useHotkeys([[HOTKEYS.CONTINUE, onReload]]);

  return (
    <Container size="md" py="xl">
      <Box p="md">
        <Title order={3} mb="md">
          Lesson Complete
        </Title>
        <Box mb="lg">
          <Button onClick={onReload} variant="filled" fullWidth mb="xs">
            Fetch More Quizzes ({HOTKEYS.CONTINUE})
          </Button>
        </Box>
        <Text mb="md">
          You've reviewed all available quizzes for this session. You can:
        </Text>
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
};

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
    onGradingResultCaptured,
    progress,
    cardsRemaining,
  } = useReview(deckId, playbackPercentage);

  if (error) {
    return <MessageState title="Error">{error.message}</MessageState>;
  }
  if (isFetching) {
    return <MessageState title="Loading">Fetching quizzes…</MessageState>;
  }
  if (!currentItem) {
    return (
      <NoMoreQuizzesState deckId={deckId} onReload={refetchQuizzes} />
    );
  }

  const card = state.cards[currentItem.cardUUID];
  if (!card) {
    return <MessageState title="Oops">No card data.</MessageState>;
  }

  return (
    <Container size="xl" py="md">
      <Box p="md">
        <CardReview
          card={card}
          itemType={currentItem.itemType}
          onSkip={skipCard}
          onGiveUp={giveUp}
          onProceed={() => {
            completeItem(currentItem.stepUuid);
          }}
          recordings={state.recordings}
          currentStepUuid={currentItem.stepUuid}
          onRecordingComplete={(audio: string) => {
            onRecordingCaptured(currentItem.stepUuid, audio);
          }}
          completeItem={completeItem}
          onGradingResultCaptured={onGradingResultCaptured}
          progress={progress}
          cardsRemaining={cardsRemaining}
        />
      </Box>
    </Container>
  );
}

export default function ReviewDeckPageWrapper(props: ReviewDeckPageProps) {
  return MicrophonePermissions(<InnerReviewPage {...props} />);
}
