import { uid } from "radash";
import { useEffect, useReducer, useState } from "react";
import { trpc } from "../trpc-config";
import { replaceCards } from "./replace-cards";
import {
  Action,
  EVERY_QUEUE_TYPE,
  Queue,
  QueueItem,
  SkipCardAction,
  State,
} from "./types";
import { playAudio } from "../play-audio";

const queue = (): Queue => ({
  newWordIntro: [], // DONE
  remedialIntro: [], // DONE
  listening: [],
  speaking: [], // Needs testing.
  newWordOutro: [], // DONE
  remedialOutro: [], // DONE
});

function removeCardFromQueues(
  cardUUID: string,
  queue: Queue,
): { updatedQueue: Queue } {
  const updatedQueue = { ...queue };

  for (const type of EVERY_QUEUE_TYPE) {
    updatedQueue[type] = updatedQueue[type].filter(
      (item) => item.cardUUID !== cardUUID,
    );
  }

  return { updatedQueue };
}

function skipCard(action: SkipCardAction, state: State): State {
  const cardUUID = action.payload.uuid;
  const { updatedQueue } = removeCardFromQueues(cardUUID, state.queue);

  return {
    ...state,
    queue: updatedQueue,
    currentItem: nextQueueItem(updatedQueue),
  };
}

function getItemsDue(queue: Queue): number {
  const relevant: (keyof Queue)[] = [
    "newWordIntro",
    "remedialIntro",
    "listening",
    "speaking",
    "newWordOutro",
    "remedialOutro",
  ];
  return relevant.reduce((acc, type) => acc + queue[type].length, 0);
}

export function nextQueueItem(queue: Queue): QueueItem | undefined {
  // Get first item from the queue with the highest priority:
  for (const type of EVERY_QUEUE_TYPE) {
    const item = queue[type][0];
    if (item) {
      return item;
    }
  }
  return;
}

function initialState(): State {
  return {
    queue: queue(),
    cards: {},
    currentItem: undefined,
    recordings: {},
    gradingResults: {},
    initialCardCount: 0,
    completedCards: new Set(),
  };
}

export function useReview(deckId: number, playbackPercentage = 0.125) {
  const mutation = trpc.getNextQuizzes.useMutation();
  const repairCardMutation = trpc.editCard.useMutation();
  const [state, dispatch] = useReducer(reducer, initialState());
  const [isFetching, setIsFetching] = useState(true);

  const fetchQuizzes = (currentDeckId: number) => {
    setIsFetching(true);
    mutation
      .mutateAsync(
        { take: 6, deckId: currentDeckId },
        {
          onSuccess: (fetchedData) => {
            const withUUID = fetchedData.quizzes.map((q) => ({
              ...q,
              uuid: uid(8),
            }));
            dispatch({ type: "REPLACE_CARDS", payload: withUUID });
          },
        },
      )
      .finally(() => setIsFetching(false));
  };

  useEffect(() => {
    if (deckId) {
      fetchQuizzes(deckId);
    }
  }, [deckId]);

  const progress =
    state.initialCardCount > 0
      ? (state.completedCards.size / state.initialCardCount) * 100
      : 0;

  return {
    error: mutation.isError ? mutation.error || "" : null,
    isFetching,
    state,
    currentItem: state.currentItem,
    totalDue: getItemsDue(state.queue),
    gradingResults: state.gradingResults,
    progress,
    cardsRemaining: state.initialCardCount - state.completedCards.size,
    skipCard: (cardUUID: string) => {
      dispatch({ type: "SKIP_CARD", payload: { uuid: cardUUID } });
    },
    giveUp: async (cardUUID: string) => {
      const card = state.cards[cardUUID];
      if (card && card.termAudio) {
        await playAudio(card.termAudio);
      }
      dispatch({ type: "GIVE_UP", payload: { cardUUID } });
    },
    onRecordingCaptured: async (uuid: string, audio: string) => {
      // Playback based on user setting prefs.
      const shouldPlayback = Math.random() < playbackPercentage;
      if (shouldPlayback) {
        await playAudio(audio);
      }
      dispatch({ type: "RECORDING_CAPTURED", payload: { uuid, audio } });
    },
    clearRecording: (uuid: string) => {
      dispatch({ type: "CLEAR_RECORDING", payload: { uuid } });
    },
    completeItem: (uuid: string) => {
      dispatch({ type: "COMPLETE_ITEM", payload: { uuid } });
    },
    onGradingResultCaptured: async (
      cardUUID: string,
      result: {
        transcription: string;
        isCorrect: boolean;
        feedback: string;
      },
    ) => {
      const card = state.cards[cardUUID];
      if (result.isCorrect && card.lessonType === "remedial") {
        await repairCardMutation.mutateAsync({
          id: card.cardId,
          lastFailure: 0,
        });
      }
      dispatch({
        type: "STORE_GRADE_RESULT",
        payload: { cardUUID, result },
      });
    },
    refetchQuizzes: () => {
      fetchQuizzes(deckId);
    },
  };
}

function reducer(state: State, action: Action): State {
  console.log(action.type);
  console.log({
    ...state,
    recordings: Object.keys(state.recordings).length,
    gradingResults: state.gradingResults,
  });
  switch (action.type) {
    case "REPLACE_CARDS":
      const newState = replaceCards(action, state);
      return {
        ...newState,
        initialCardCount: Object.keys(newState.cards).length,
        completedCards: new Set(),
      };
    case "SKIP_CARD":
      return {
        ...skipCard(action, state),
        completedCards: new Set([
          ...state.completedCards,
          action.payload.uuid,
        ]),
      };
    case "RECORDING_CAPTURED":
      return {
        ...state,
        recordings: {
          ...state.recordings,
          [action.payload.uuid]: {
            stepUuid: action.payload.uuid,
            audio: action.payload.audio,
          },
        },
      };
    case "CLEAR_RECORDING":
      const { [action.payload.uuid]: _, ...remainingRecordings } =
        state.recordings;
      return {
        ...state,
        recordings: remainingRecordings,
      };
    case "COMPLETE_ITEM":
      const { uuid } = action.payload;
      const updatedQueue = { ...state.queue };

      // Find which card this item belongs to
      let cardUUID: string | undefined;
      for (const queueType of EVERY_QUEUE_TYPE) {
        const item = state.queue[queueType].find(
          (item) => item.stepUuid === uuid,
        );
        if (item) {
          cardUUID = item.cardUUID;
          break;
        }
      }

      // Remove the item from all queue types by stepUuid
      for (const queueType of EVERY_QUEUE_TYPE) {
        updatedQueue[queueType] = updatedQueue[queueType].filter(
          (item) => item.stepUuid !== uuid,
        );
      }

      // Check if this was the last item for this card
      const hasMoreItems = Object.values(updatedQueue).some((queue) =>
        queue.some((item) => item.cardUUID === cardUUID),
      );

      return {
        ...state,
        queue: updatedQueue,
        currentItem: nextQueueItem(updatedQueue),
        completedCards:
          !hasMoreItems && cardUUID
            ? new Set([...state.completedCards, cardUUID])
            : state.completedCards,
      };
    case "GIVE_UP":
      const { cardUUID: giveUpCardUUID } = action.payload;
      const { updatedQueue: giveUpQueue } = removeCardFromQueues(
        giveUpCardUUID,
        state.queue,
      );

      return {
        ...state,
        queue: giveUpQueue,
        currentItem: nextQueueItem(giveUpQueue),
        completedCards: new Set([...state.completedCards, giveUpCardUUID]),
      };
    case "STORE_GRADE_RESULT":
      return {
        ...state,
        gradingResults: {
          ...state.gradingResults,
          [action.payload.cardUUID]: action.payload.result,
        },
      };
    default:
      return state;
  }
}
