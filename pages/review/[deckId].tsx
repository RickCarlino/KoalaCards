import { canStartNewLessons, getLessonsDue } from "@/koala/fetch-lesson";
import { getServersideUser } from "@/koala/get-serverside-user";
import { playAudio } from "@/koala/play-audio";
import { prismaClient } from "@/koala/prisma-client";
import { CardReview } from "@/koala/review";
import { HOTKEYS } from "@/koala/review/hotkeys";
import { playTermThenDefinition } from "@/koala/review/playback";
import { useReview } from "@/koala/review/reducer";
import { GradingResult, State } from "@/koala/review/types";
import { useUserSettings } from "@/koala/settings-provider";
import { DeckSummary } from "@/koala/types/deck-summary";
import {
  Anchor,
  Box,
  Button,
  Container,
  Flex,
  Paper,
  Stack,
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
const REVIEW_BACKGROUND =
  "linear-gradient(180deg, rgba(255,240,246,0.35) 0%, rgba(255,255,255,1) 30%)";

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

type ReviewStateCardProps = {
  title: string;
  children: React.ReactNode;
};

function ReviewStateCard({ title, children }: ReviewStateCardProps) {
  return (
    <Container size="sm" py="xl">
      <Paper withBorder p="xl" radius="lg">
        <Stack gap="md">
          <Title order={3}>{title}</Title>
          {children}
        </Stack>
      </Paper>
    </Container>
  );
}

const MessageState = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <ReviewStateCard title={title}>
    <Text c="gray.7">{children}</Text>
  </ReviewStateCard>
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
    <ReviewStateCard title="Lesson Complete">
      <Stack gap="sm">
        <Button onClick={onReload} variant="filled" fullWidth>
          Fetch More Quizzes ({HOTKEYS.CONTINUE})
        </Button>
        <Text c="gray.7">
          You've reviewed all available quizzes for this session. You can:
        </Text>
        <Stack gap={4}>
          <Anchor component={Link} href={`/cards?deckId=${deckId}`}>
            Add more cards to this deck
          </Anchor>
          <Anchor component={Link} href={writingPracticeUrl}>
            Practice Writing
          </Anchor>
          <Anchor component={Link} href="/review">
            Go back to deck selection
          </Anchor>
        </Stack>
      </Stack>
    </ReviewStateCard>
  );
};

type ReviewLayoutProps = {
  contentHeight: string;
  showAssistant: boolean;
  assistant: React.ReactNode;
  children: React.ReactNode;
};

function ReviewLayout({
  contentHeight,
  showAssistant,
  assistant,
  children,
}: ReviewLayoutProps) {
  return (
    <Box
      w="100%"
      h={contentHeight}
      mih={contentHeight}
      style={{ background: REVIEW_BACKGROUND }}
    >
      <Flex h="100%" mih={0} align="stretch" gap="md">
        <Box flex={1} h="100%" mih={0} py="md">
          {children}
        </Box>
        {showAssistant && (
          <Box w={ASSISTANT_PANEL_WIDTH} h="100%" mih={0}>
            {assistant}
          </Box>
        )}
      </Flex>
    </Box>
  );
}

type ReviewLayoutState = {
  assistantOpen: boolean;
  openAssistant: () => void;
  closeAssistant: () => void;
  showDesktopAssistant: boolean;
  assistantOffset: number;
  isDesktop: boolean;
  contentHeight: string;
};

function useReviewLayout(): ReviewLayoutState {
  const [assistantOpen, setAssistantOpen] = React.useState(false);
  const theme = useMantineTheme();
  const isDesktop =
    useMediaQuery(`(min-width: ${theme.breakpoints.md})`) ?? false;

  React.useEffect(() => {
    if (isDesktop) {
      setAssistantOpen(true);
    }
  }, [isDesktop]);

  const contentHeight = "100vh";
  const showDesktopAssistant = isDesktop && assistantOpen;
  const assistantOffset = showDesktopAssistant ? ASSISTANT_PANEL_WIDTH : 0;

  const openAssistant = React.useCallback(
    () => setAssistantOpen(true),
    [],
  );
  const closeAssistant = React.useCallback(
    () => setAssistantOpen(false),
    [],
  );

  return {
    assistantOpen,
    openAssistant,
    closeAssistant,
    showDesktopAssistant,
    assistantOffset,
    isDesktop,
    contentHeight,
  };
}

type ReviewHandlersParams = {
  state: State;
  addContextEvent: (type: string, summary: string) => void;
  skipCard: (cardUUID: string) => void;
  giveUp: (cardUUID: string) => void;
  captureGradingResult: (cardUUID: string, result: GradingResult) => void;
  updateCardFields: (
    cardId: number,
    updates: { term: string; definition: string },
  ) => void;
};

function useReviewHandlers({
  state,
  addContextEvent,
  skipCard,
  giveUp,
  captureGradingResult,
  updateCardFields,
}: ReviewHandlersParams) {
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

  return {
    handleGradingResultCaptured,
    handleSkipCard,
    handleGiveUp,
    handleAssistantCardEdited,
  };
}

function InnerReviewPage({ deckId, decks }: ReviewDeckPageProps) {
  const layout = useReviewLayout();
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

  const {
    handleGradingResultCaptured,
    handleSkipCard,
    handleGiveUp,
    handleAssistantCardEdited,
  } = useReviewHandlers({
    state,
    addContextEvent,
    skipCard,
    giveUp,
    captureGradingResult,
    updateCardFields,
  });

  const playCard = React.useCallback(async () => {
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
  }, [card, currentItem?.itemType, userSettings.playbackSpeed]);

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
      void playCard();
    }
  }, [currentItem, playCard]);

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
    opened: layout.assistantOpen,
    onOpen: layout.openAssistant,
    onClose: layout.closeAssistant,
    contextLog,
    currentCard: assistantCardContext,
    onCardEdited: handleAssistantCardEdited,
  };

  return (
    <Container fluid px={0} py={0}>
      <ReviewLayout
        contentHeight={layout.contentHeight}
        showAssistant={layout.showDesktopAssistant}
        assistant={<ReviewAssistantPane {...assistantProps} />}
      >
        <Box h="100%" mih={0}>
          <CardReview
            card={card}
            itemType={currentItem.itemType}
            onSkip={handleSkipCard}
            onGiveUp={handleGiveUp}
            onProceed={() => completeItem(currentItem.stepUuid)}
            onPlayAudio={playCard}
            currentStepUuid={currentItem.stepUuid}
            completeItem={completeItem}
            onGradingResultCaptured={handleGradingResultCaptured}
            progress={progress}
            cardsRemaining={cardsRemaining}
            onOpenAssistant={layout.openAssistant}
            assistantOffsetRight={layout.assistantOffset}
            disableRecord={Boolean(
              state.gradingResults[currentItem.cardUUID]?.isCorrect,
            )}
          />
        </Box>
      </ReviewLayout>
      {!layout.isDesktop && <ReviewAssistantPane {...assistantProps} />}
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
