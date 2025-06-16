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
  feedback: [], // Unused ... ?
  newWordIntro: [], // DONE
  remedialIntro: [], // DONE
  listening: [],
  speaking: [], // Needs testing.
  newWordOutro: [], // DONE
  remedialOutro: [], // DONE
  pending: [], // Unused ... ?
});

function removeCardFromQueues(
  cardUUID: string,
  queue: Queue,
): { updatedQueue: Queue; itemsRemoved: number } {
  const updatedQueue = { ...queue };
  let itemsRemoved = 0;

  for (const type of EVERY_QUEUE_TYPE) {
    const originalLength = updatedQueue[type].length;
    updatedQueue[type] = updatedQueue[type].filter(
      (item) => item.cardUUID !== cardUUID,
    );
    itemsRemoved += originalLength - updatedQueue[type].length;
  }

  return { updatedQueue, itemsRemoved };
}

function skipCard(action: SkipCardAction, state: State): State {
  const cardUUID = action.payload.uuid;
  const { updatedQueue, itemsRemoved } = removeCardFromQueues(
    cardUUID,
    state.queue,
  );

  return {
    ...state,
    queue: updatedQueue,
    itemsComplete: state.itemsComplete + itemsRemoved,
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
    if (item) return item;
  }
  return;
}

function initialState(): State {
  return {
    queue: queue(),
    cards: {},
    currentItem: undefined,
    totalItems: 0,
    itemsComplete: 0,
    recordings: {},
    gradingResults: {},
  };
}

export function useReview(deckId: number, playbackPercentage = 0.125) {
  const mutation = trpc.getNextQuizzes.useMutation();
  const [state, dispatch] = useReducer(reducer, initialState());
  const [isFetching, setIsFetching] = useState(true);

  const fetchQuizzes = (currentDeckId: number) => {
    setIsFetching(true);
    mutation
      .mutateAsync(
        { take: 12, deckId: currentDeckId },
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

  return {
    error: mutation.isError ? mutation.error || "" : null,
    isFetching,
    state,
    currentItem: state.currentItem,
    totalDue: getItemsDue(state.queue),
    gradingResults: state.gradingResults,
    skipCard: (cardUUID: string) => {
      dispatch({ type: "SKIP_CARD", payload: { uuid: cardUUID } });
    },
    giveUp: (cardUUID: string) => {
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
    onGradingResultCaptured: (
      cardUUID: string,
      result: {
        transcription: string;
        isCorrect: boolean;
        feedback: string;
      },
    ) => {
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
  console.log({
    ...state,
    recordings: Object.keys(state.recordings).length,
    gradingResults: state.gradingResults,
    action: action.type,
  });
  switch (action.type) {
    case "REPLACE_CARDS":
      return replaceCards(action, state);
    case "SKIP_CARD":
      return skipCard(action, state);
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

      // Remove the item from all queue types by stepUuid
      for (const queueType of EVERY_QUEUE_TYPE) {
        updatedQueue[queueType] = updatedQueue[queueType].filter(
          (item) => item.stepUuid !== uuid,
        );
      }

      return {
        ...state,
        queue: updatedQueue,
        currentItem: nextQueueItem(updatedQueue),
        itemsComplete: state.itemsComplete + 1,
      };
    case "GIVE_UP":
      const { cardUUID } = action.payload;
      const {
        updatedQueue: giveUpQueue,
        itemsRemoved: giveUpItemsRemoved,
      } = removeCardFromQueues(cardUUID, state.queue);

      return {
        ...state,
        queue: giveUpQueue,
        currentItem: nextQueueItem(giveUpQueue),
        itemsComplete: state.itemsComplete + giveUpItemsRemoved,
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
