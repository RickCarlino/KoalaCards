import { z } from "zod";
import { QuizList } from "../types/zod";
import { uid } from "radash";
import { useState, useEffect, useReducer } from "react";
import { trpc } from "../trpc-config";

type QuizList = z.infer<typeof QuizList>["quizzes"];

type QueueItem = { cardUUID: string; itemType: keyof Queue };

type QueueType =
  | "feedback"
  | "listening"
  | "newWordIntro"
  | "newWordOutro"
  | "pending"
  | "remedialIntro"
  | "remedialOutro"
  | "removed"
  | "speaking";

type Queue = Record<QueueType, QueueItem[]>;

type Quiz = QuizList[number] & { uuid: string };

type State = {
  queue: Queue;
  cards: Record<string, Quiz>;
};

const queue = (): Queue => ({
  feedback: [],
  newWordIntro: [],
  remedialIntro: [],
  listening: [],
  speaking: [],
  newWordOutro: [],
  remedialOutro: [],
  pending: [],
  removed: [],
});

type Action = { type: "REPLACE_CARDS"; payload: Quiz[] };

const PRIORTY: (keyof Queue)[] = [
  "feedback",
  "newWordIntro",
  "remedialIntro",
  "listening",
  "speaking",
  "newWordOutro",
  "remedialOutro",
  "pending",
  "removed",
];

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
  for (const type of PRIORTY) {
    const item = queue[type][0];
    if (item) return item;
  }
  return;
}

export function initialState(): State {
  return { queue: queue(), cards: {} };
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
  };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "REPLACE_CARDS":
      const cards = action.payload.reduce(
        (acc: Record<string, Quiz>, item) => {
          return { ...acc, [item.uuid]: item };
        },
        {} as Record<string, Quiz>,
      );

      const queue = action.payload.reduce((acc, item) => {
        switch (item.lessonType) {
          case "new":
            return {
              ...acc,
              newWordIntro: [
                ...acc.newWordIntro,
                { cardUUID: item.uuid, itemType: "newWordIntro" as const },
              ],
              newWordOutro: [
                ...acc.newWordOutro,
                { cardUUID: item.uuid, itemType: "newWordOutro" as const },
              ],
            };
          case "listening":
            return {
              ...acc,
              listening: [
                ...acc.listening,
                { cardUUID: item.uuid, itemType: "listening" as const },
              ],
            };
          case "speaking":
            return {
              ...acc,
              speaking: [
                ...acc.speaking,
                { cardUUID: item.uuid, itemType: "speaking" as const },
              ],
            };
          case "remedial":
            return {
              ...acc,
              remedialIntro: [
                ...acc.remedialIntro,
                {
                  cardUUID: item.uuid,
                  itemType: "remedialIntro" as const,
                },
              ],
              remedialOutro: [
                ...acc.remedialOutro,
                {
                  cardUUID: item.uuid,
                  itemType: "remedialOutro" as const,
                },
              ],
            };
          default:
            throw new Error(`Unknown lesson type: ${item.lessonType}`);
        }
      }, state.queue);
      return { ...state, queue, cards };
    default:
      return state;
  }
}
