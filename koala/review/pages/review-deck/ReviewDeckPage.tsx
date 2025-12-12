import ReviewAssistantPane from "@/koala/components/ReviewAssistantPane";
import { playAudio } from "@/koala/play-audio";
import { CardReview } from "@/koala/review";
import { playTermThenDefinition } from "@/koala/review/playback";
import { useReview } from "@/koala/review/reducer";
import { useUserSettings } from "@/koala/settings-provider";
import {
  StudyAssistantContextProvider,
  useStudyAssistantContext,
} from "@/koala/study-assistant-context";
import { GradingResult } from "@/koala/review/types";
import { Box, Container, useMantineTheme } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import React from "react";
import { MessageState, NoMoreQuizzesState } from "./ReviewDeckStates";
import {
  ASSISTANT_PANEL_WIDTH,
  buildAssistantCardContext,
  buildCardEditedEvent,
  buildCardShownEvent,
  buildGradingResultEvent,
  buildSimpleCardEvent,
  getContentHeight,
  getGridTemplateColumns,
  getHeaderHeight,
  isAudioAutoPlayItemType,
  isDefinitionAudioItemType,
  isRecordDisabled,
} from "./reviewDeckHelpers";

type ReviewDeckPageProps = { deckId: number };

function ReviewDeckInner({ deckId }: ReviewDeckPageProps) {
  const [assistantOpen, setAssistantOpen] = React.useState(false);
  const theme = useMantineTheme();
  const isDesktop =
    useMediaQuery(`(min-width: ${theme.breakpoints.md})`) ?? false;
  const isLargeDesktop =
    useMediaQuery(`(min-width: ${theme.breakpoints.lg})`) ?? false;

  const userSettings = useUserSettings();
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

  const card = currentItem ? state.cards[currentItem.cardUUID] : undefined;
  const currentStepUuid = currentItem?.stepUuid;
  const assistantCardContext = React.useMemo(
    () => buildAssistantCardContext(card),
    [card],
  );

  React.useEffect(() => {
    if (isDesktop) {
      setAssistantOpen(true);
    }
  }, [isDesktop]);

  const headerHeight = React.useMemo(
    () => getHeaderHeight({ isDesktop, isLargeDesktop }),
    [isDesktop, isLargeDesktop],
  );
  const contentHeight = React.useMemo(
    () => getContentHeight({ isDesktop, headerHeight }),
    [headerHeight, isDesktop],
  );

  const showDesktopAssistant = isDesktop && assistantOpen;
  const gridTemplateColumns = React.useMemo(
    () => getGridTemplateColumns({ showDesktopAssistant }),
    [showDesktopAssistant],
  );

  const openAssistant = React.useCallback(
    () => setAssistantOpen(true),
    [],
  );
  const closeAssistant = React.useCallback(
    () => setAssistantOpen(false),
    [],
  );

  const playCard = React.useCallback(async () => {
    if (!card || !currentItem) {
      return;
    }
    if (isAudioAutoPlayItemType(currentItem.itemType)) {
      await playTermThenDefinition(card, userSettings.playbackSpeed);
      return;
    }
    if (isDefinitionAudioItemType(currentItem.itemType)) {
      await playAudio(card.definitionAudio, userSettings.playbackSpeed);
    }
  }, [card, currentItem, userSettings.playbackSpeed]);

  React.useEffect(() => {
    if (!card || !currentItem) {
      return;
    }
    addContextEvent("card-shown", buildCardShownEvent(card, currentItem));
  }, [addContextEvent, card, currentItem]);

  React.useEffect(() => {
    if (currentItem) {
      void playCard();
    }
  }, [currentItem, playCard]);

  const handleGradingResultCaptured = React.useCallback(
    (cardUUID: string, result: GradingResult) => {
      const cardForResult = state.cards[cardUUID];
      if (cardForResult) {
        const event = buildGradingResultEvent(cardForResult, result);
        if (event) {
          addContextEvent("grading-result", event);
        }
      }
      captureGradingResult(cardUUID, result);
    },
    [addContextEvent, captureGradingResult, state.cards],
  );

  const handleSkipCard = React.useCallback(
    (cardUUID: string) => {
      const skipped = state.cards[cardUUID];
      if (skipped) {
        addContextEvent("skip-card", buildSimpleCardEvent(skipped));
      }
      skipCard(cardUUID);
    },
    [addContextEvent, skipCard, state.cards],
  );

  const handleGiveUp = React.useCallback(
    (cardUUID: string) => {
      const abandoned = state.cards[cardUUID];
      if (abandoned) {
        addContextEvent("gave-up", buildSimpleCardEvent(abandoned));
      }
      giveUp(cardUUID);
    },
    [addContextEvent, giveUp, state.cards],
  );

  const handleAssistantCardEdited = React.useCallback(
    (cardId: number, updates: { term: string; definition: string }) => {
      updateCardFields(cardId, updates);
      const event = buildCardEditedEvent({
        cards: state.cards,
        cardId,
        updates,
      });
      if (!event) {
        return;
      }
      addContextEvent("card-edited", event);
    },
    [addContextEvent, state.cards, updateCardFields],
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
  if (!card || !currentStepUuid) {
    return <MessageState title="Oops">No card data.</MessageState>;
  }

  const assistantProps = {
    deckId,
    opened: assistantOpen,
    onOpen: openAssistant,
    onClose: closeAssistant,
    contextLog,
    currentCard: assistantCardContext,
    onCardEdited: handleAssistantCardEdited,
  };

  const assistantOffsetRight = showDesktopAssistant
    ? ASSISTANT_PANEL_WIDTH
    : 0;

  return (
    <Container fluid px={0} py={0}>
      <Box
        style={{
          display: "grid",
          gridTemplateColumns,
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
            onProceed={() => completeItem(currentStepUuid)}
            onPlayAudio={playCard}
            currentStepUuid={currentStepUuid}
            completeItem={completeItem}
            onGradingResultCaptured={handleGradingResultCaptured}
            progress={progress}
            cardsRemaining={cardsRemaining}
            onOpenAssistant={openAssistant}
            assistantOffsetRight={assistantOffsetRight}
            disableRecord={isRecordDisabled({
              gradingResults: state.gradingResults,
              cardUUID: currentItem.cardUUID,
            })}
          />
        </Box>

        {showDesktopAssistant ? (
          <ReviewAssistantPane {...assistantProps} />
        ) : null}
      </Box>

      {!isDesktop ? <ReviewAssistantPane {...assistantProps} /> : null}
    </Container>
  );
}

export default function ReviewDeckPage(props: ReviewDeckPageProps) {
  return (
    <StudyAssistantContextProvider>
      <ReviewDeckInner {...props} />
    </StudyAssistantContextProvider>
  );
}
