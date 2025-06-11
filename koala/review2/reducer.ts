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

const queue = (): Queue => ({
  feedback: [],
  newWordIntro: [], // DONE
  remedialIntro: [], // DONE
  listening: [],
  speaking: [], // Needs testing.
  newWordOutro: [], // DONE
  remedialOutro: [], // DONE
  pending: [],
});

export function skipCard(action: SkipCardAction, state: State): State {
  const cardUUID = action.payload.uuid;
  const newQueue = { ...state.queue };
  for (const type of EVERY_QUEUE_TYPE) {
    newQueue[type] = newQueue[type].filter(
      (item) => item.cardUUID !== cardUUID,
    );
  }
  return {
    ...state,
    queue: newQueue,
    itemsComplete: state.itemsComplete + 1,
    currentItem: nextQueueItem(newQueue),
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

export function initialState(): State {
  return {
    queue: queue(),
    cards: {},
    currentItem: undefined,
    totalItems: 0,
    itemsComplete: 0,
    recordings: {},
  };
}

export function useReview(deckId: number) {
  const mutation = trpc.getNextQuizzes.useMutation();
  const [state, dispatch] = useReducer(reducer, initialState());
  const [isFetching, setIsFetching] = useState(true);

  const fetchQuizzes = (currentDeckId: number) => {
    setIsFetching(true);
    mutation
      .mutateAsync(
        { take: 4, deckId: currentDeckId },
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
    skipCard: (cardUUID: string) => {
      dispatch({ type: "SKIP_CARD", payload: { uuid: cardUUID } });
    },
    giveUp: (cardUUID: string) => {
      dispatch({ type: "GIVE_UP", payload: { cardUUID } });
    },
    onRecordingCaptured: (uuid: string, audio: string) => {
      dispatch({ type: "RECORDING_CAPTURED", payload: { uuid, audio } });
    },
    clearRecording: (uuid: string) => {
      dispatch({ type: "CLEAR_RECORDING", payload: { uuid } });
    },
    completeItem: (uuid: string) => {
      dispatch({ type: "COMPLETE_ITEM", payload: { uuid } });
    },
  };
}

export function reducer(state: State, action: Action): State {
  console.log({
    ...state,
    recordings: Object.keys(state.recordings).length,
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
      const giveUpQueue = { ...state.queue };

      // Remove all items with matching cardUUID from all queue types
      for (const queueType of EVERY_QUEUE_TYPE) {
        giveUpQueue[queueType] = giveUpQueue[queueType].filter(
          (item) => item.cardUUID !== cardUUID,
        );
      }

      return {
        ...state,
        queue: giveUpQueue,
        currentItem: nextQueueItem(giveUpQueue),
        itemsComplete: state.itemsComplete + 1, // Increment complete count
      };
    default:
      return state;
  }
}
