import { canStartNewLessons, getLessonsDue } from "@/koala/fetch-lesson";
import { getServersideUser } from "@/koala/get-serverside-user";
import { playAudio } from "@/koala/play-audio";
import { prismaClient } from "@/koala/prisma-client";
import { CardReview } from "@/koala/review";
import { HOTKEYS } from "@/koala/review/hotkeys";
import { useReview } from "@/koala/review/reducer";
import { useUserSettings } from "@/koala/settings-provider";
import { GradingResult } from "@/koala/review/types";
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
import ReviewAssistantPane from "@/koala/components/ReviewAssistantPane";
import {
  StudyAssistantContextProvider,
  useStudyAssistantContext,
} from "@/koala/study-assistant-context";
type ReviewDeckPageProps = { deckId: number };

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

  const hasDue = (await getLessonsDue(deck.id)) >= 1;
  const canStartNew = await canStartNewLessons(
    user.id,
    deck.id,
    Date.now(),
  );
  if (!hasDue && !canStartNew) {
    return redirect("/review");
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

function InnerReviewPage({ deckId }: ReviewDeckPageProps) {
  const [assistantOpen, setAssistantOpen] = React.useState(false);
  const { addContextEvent, contextLog } = useStudyAssistantContext();
  const {
    state,
    isFetching,
    error,
    currentItem,
    skipCard,
    giveUp,
    completeItem,
    refetchQuizzes,
    onGradingResultCaptured: captureGradingResult,
    progress,
    cardsRemaining,
  } = useReview(deckId);
  const userSettings = useUserSettings();
  const card = currentItem ? state.cards[currentItem.cardUUID] : undefined;

  async function playCard() {
    if (!card) {
      console.warn("No card available for playback.");
      return;
    }
    switch (currentItem?.itemType) {
      case "remedialIntro":
      case "newWordIntro":
        return await playAudio(
          card.termAndDefinitionAudio,
          userSettings.playbackSpeed,
        );
      case "speaking":
      case "newWordOutro":
      case "remedialOutro":
        return await playAudio(
          card.definitionAudio,
          userSettings.playbackSpeed,
        );
      default:
        console.warn("No audio available for this card type.");
    }
  }

  React.useEffect(() => {
    if (!card || !currentItem) {
      return;
    }
    addContextEvent(
      "card-shown",
      `Term: ${card.term}; Definition: ${card.definition}; Step: ${currentItem.itemType}`,
    );
  }, [
    addContextEvent,
    card?.definition,
    card?.term,
    card?.uuid,
    currentItem?.itemType,
    currentItem?.stepUuid,
  ]);

  // useEffect, call playCard when the currentItem changes:
  React.useEffect(() => {
    if (currentItem) {
      playCard();
    }
  }, [currentItem]);

  const handleGradingResultCaptured = React.useCallback(
    (cardUUID: string, result: GradingResult) => {
      const cardForResult = state.cards[cardUUID];
      if (cardForResult) {
        const outcome = result.isCorrect ? "correct" : "incorrect";
        const userSaid = result.transcription
          ? `User said: ${result.transcription}.`
          : "";
        const feedback = result.feedback
          ? `Feedback: ${result.feedback}.`
          : "";
        addContextEvent(
          "grading-result",
          `Card: ${cardForResult.term}; Outcome: ${outcome}. ${userSaid} ${feedback}`.trim(),
        );
      }
      captureGradingResult(cardUUID, result);
    },
    [addContextEvent, captureGradingResult, state.cards],
  );

  const handleSkipCard = React.useCallback(
    (cardUUID: string) => {
      const skipped = state.cards[cardUUID];
      if (skipped) {
        addContextEvent(
          "skip-card",
          `Card: ${skipped.term}; Definition: ${skipped.definition}`,
        );
      }
      skipCard(cardUUID);
    },
    [addContextEvent, skipCard, state.cards],
  );

  const handleGiveUp = React.useCallback(
    (cardUUID: string) => {
      const abandoned = state.cards[cardUUID];
      if (abandoned) {
        addContextEvent(
          "gave-up",
          `Card: ${abandoned.term}; Definition: ${abandoned.definition}`,
        );
      }
      giveUp(cardUUID);
    },
    [addContextEvent, giveUp, state.cards],
  );

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

  if (!card) {
    return <MessageState title="Oops">No card data.</MessageState>;
  }

  return (
    <Container size="xl" py="md">
      <Box p="md">
        <CardReview
          card={card}
          itemType={currentItem.itemType}
          onSkip={handleSkipCard}
          onGiveUp={handleGiveUp}
          onProceed={() => {
            completeItem(currentItem.stepUuid);
          }}
          onPlayAudio={playCard}
          currentStepUuid={currentItem.stepUuid}
          completeItem={completeItem}
          onGradingResultCaptured={handleGradingResultCaptured}
          progress={progress}
          cardsRemaining={cardsRemaining}
          onOpenAssistant={() => setAssistantOpen(true)}
          disableRecord={Boolean(
            state.gradingResults[currentItem.cardUUID]?.isCorrect,
          )}
        />
      </Box>
      <ReviewAssistantPane
        deckId={deckId}
        opened={assistantOpen}
        onOpen={() => setAssistantOpen(true)}
        onClose={() => setAssistantOpen(false)}
        showFloatingButton={false}
        contextLog={contextLog}
      />
    </Container>
  );
}

export default function ReviewDeckPageWrapper(props: ReviewDeckPageProps) {
  return (
    <StudyAssistantContextProvider>
      <InnerReviewPage {...props} />
    </StudyAssistantContextProvider>
  );
}
