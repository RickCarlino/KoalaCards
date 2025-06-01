import { uid } from "radash";
import { useEffect, useReducer, useState } from "react";
import { trpc } from "../trpc-config";
import { replaceCards } from "./replace-cards";
import { skipCard } from "./skip-card";
import { Action, EVERY_QUEUE_TYPE, Queue, QueueItem, State } from "./types";

const queue = (): Queue => ({
  feedback: [],
  newWordIntro: [],
  remedialIntro: [],
  listening: [],
  speaking: [],
  newWordOutro: [],
  remedialOutro: [],
  pending: [],
});

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

function nextQueueItem(queue: Queue): QueueItem | undefined {
  // Get first item from the queue with the highest priority:
  for (const type of EVERY_QUEUE_TYPE) {
    const item = queue[type][0];
    if (item) return item;
  }
  return;
}

export function initialState(): State {
  return { queue: queue(), cards: {}, totalItems: 0, itemsComplete: 0 };
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
    currentItem: nextQueueItem(state.queue),
    totalDue: getItemsDue(state.queue),
    skipCard: (cardUUID: string) => {
      dispatch({ type: "SKIP_CARD", payload: { uuid: cardUUID } });
    },
  };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "REPLACE_CARDS":
      return replaceCards(action, state);
    case "SKIP_CARD":
      return skipCard(action, state);
    default:
      return state;
  }
}
