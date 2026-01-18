import { canStartNewLessons, getLessonsDue } from "@/koala/fetch-lesson";
import { getServersideUser } from "@/koala/get-serverside-user";
import { playAudio } from "@/koala/play-audio";
import { prismaClient } from "@/koala/prisma-client";
import { CardReview } from "@/koala/review";
import { HOTKEYS } from "@/koala/review/hotkeys";
import { playTermThenDefinition } from "@/koala/review/playback";
import { useReview } from "@/koala/review/reducer";
import { useUserSettings } from "@/koala/settings-provider";
import { DeckSummary } from "@/koala/types/deck-summary";
import { GradingResult } from "@/koala/review/types";
import {
  Anchor,
  Box,
  Button,
  Container,
  Text,
  Title,
  useMantineTheme,
} from "@mantine/core";
import { useHotkeys, useMediaQuery } from "@mantine/hooks";
import { GetServerSideProps } from "next";
import Link from "next/link";
import React from "react";
import ReviewAssistantPane from "@/koala/components/ReviewAssistantPane";
import {
  StudyAssistantContextProvider,
  useStudyAssistantContext,
} from "@/koala/study-assistant-context";
type ReviewDeckPageProps = { deckId: number; decks: DeckSummary[] };
const ASSISTANT_PANEL_WIDTH = 380;

const redirect = (destination: string) => ({
  redirect: { destination, permanent: false } as const,
});

const buildReviewPath = (deckId: number) => `/review/${deckId}`;

const buildWritingPracticeUrl = (returnTo: string) =>
  `/writing/practice?returnTo=${encodeURIComponent(returnTo)}`;

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
          destination: buildWritingPracticeUrl(buildReviewPath(deckId)),
          permanent: false,
        },
      };
    }
  }

  const decks = await prismaClient.deck.findMany({
    where: { userId: user.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return {
    props: {
      deckId,
      decks,
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
  const writingPracticeUrl = buildWritingPracticeUrl(
    buildReviewPath(deckId),
  );

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
          <Anchor component={Link} href={writingPracticeUrl}>
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

function InnerReviewPage({ deckId, decks }: ReviewDeckPageProps) {
  const [assistantOpen, setAssistantOpen] = React.useState(false);
  const theme = useMantineTheme();
  const isDesktop = useMediaQuery(`(min-width: ${theme.breakpoints.md})`);
  const isLargeDesktop = useMediaQuery(
    `(min-width: ${theme.breakpoints.lg})`,
  );
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
    updateCardFields,
  } = useReview(deckId);
  const userSettings = useUserSettings();
  const card = currentItem ? state.cards[currentItem.cardUUID] : undefined;
  const assistantCardContext = React.useMemo(
    () =>
      card
        ? {
            cardId: card.cardId,
            term: card.term,
            definition: card.definition,
            uuid: card.uuid,
          }
        : undefined,
    [card?.cardId, card?.definition, card?.term, card?.uuid],
  );

  React.useEffect(() => {
    if (isDesktop) {
      setAssistantOpen(true);
    }
  }, [isDesktop]);

  const headerHeight = React.useMemo(() => {
    if (isLargeDesktop) {
      return 80;
    }
    if (isDesktop) {
      return 70;
    }
    return 60;
  }, [isDesktop, isLargeDesktop]);
  const contentHeight = isDesktop
    ? `calc(100vh - ${headerHeight}px)`
    : "100vh";
  const showDesktopAssistant = isDesktop && assistantOpen;
  const gridTemplate = showDesktopAssistant
    ? `1fr ${ASSISTANT_PANEL_WIDTH}px`
    : "1fr";

  async function playCard() {
    if (!card) {
      console.warn("No card available for playback.");
      return;
    }
    switch (currentItem?.itemType) {
      case "remedialIntro":
      case "newWordIntro":
        return await playTermThenDefinition(
          card,
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
      `CardID: ${card.cardId}; Term: ${card.term}; Definition: ${card.definition}; Step: ${currentItem.itemType}`,
    );
  }, [
    addContextEvent,
    card?.definition,
    card?.cardId,
    card?.term,
    card?.uuid,
    currentItem?.itemType,
    currentItem?.stepUuid,
  ]);

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

  const handleAssistantCardEdited = React.useCallback(
    (cardId: number, updates: { term: string; definition: string }) => {
      updateCardFields(cardId, updates);
      const matchingCard = Object.values(state.cards).find(
        (item) => item.cardId === cardId,
      );
      if (!matchingCard) {
        return;
      }
      const termForLog = updates.term ?? matchingCard.term;
      const definitionForLog =
        updates.definition ?? matchingCard.definition;
      if (!termForLog && !definitionForLog) {
        return;
      }
      addContextEvent(
        "card-edited",
        `CardID ${cardId}; Term: ${termForLog || "(unchanged)"}; Definition: ${definitionForLog || "(unchanged)"}`,
      );
    },
    [addContextEvent, state.cards, updateCardFields],
  );

  const openAssistant = React.useCallback(
    () => setAssistantOpen(true),
    [],
  );
  const closeAssistant = React.useCallback(
    () => setAssistantOpen(false),
    [],
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

  const assistantProps = {
    deckId,
    decks,
    opened: assistantOpen,
    onOpen: openAssistant,
    onClose: closeAssistant,
    contextLog,
    currentCard: assistantCardContext,
    onCardEdited: handleAssistantCardEdited,
  };
  const assistantOffset = showDesktopAssistant ? ASSISTANT_PANEL_WIDTH : 0;

  return (
    <Container fluid px={0} py={0}>
      <Box
        style={{
          display: "grid",
          gridTemplateColumns: gridTemplate,
          gridTemplateRows: "1fr",
          gap: "16px",
          alignItems: "stretch",
          minHeight: contentHeight,
          height: contentHeight,
          width: "100%",
        }}
      >
        <Box py="md" style={{ height: "100%", minHeight: 0 }}>
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
            onOpenAssistant={openAssistant}
            assistantOffsetRight={assistantOffset}
            disableRecord={Boolean(
              state.gradingResults[currentItem.cardUUID]?.isCorrect,
            )}
          />
        </Box>

        {showDesktopAssistant && (
          <ReviewAssistantPane {...assistantProps} />
        )}
      </Box>
      {!isDesktop && <ReviewAssistantPane {...assistantProps} />}
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
