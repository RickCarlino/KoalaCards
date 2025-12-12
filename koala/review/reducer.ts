import { uid } from "radash";
import { useCallback, useEffect, useReducer, useState } from "react";
import { trpc } from "../trpc-config";
import { replaceCards } from "./replace-cards";
import {
  Action,
  EVERY_QUEUE_TYPE,
  Queue,
  QueueItem,
  State,
  GradingResult,
} from "./types";
import { useUserSettings } from "@/koala/settings-provider";
import { playTermThenDefinition } from "./playback";

const DEFAULT_TAKE = 5;
const MIN_TAKE = 1;
const MAX_TAKE = 25;

const createEmptyQueue = (): Queue => ({
  newWordIntro: [],
  remedialIntro: [],
  speaking: [],
  newWordOutro: [],
  remedialOutro: [],
});

const filterQueue = (
  queue: Queue,
  predicate: (item: QueueItem) => boolean,
): Queue => {
  const next: Queue = { ...queue };
  for (const type of EVERY_QUEUE_TYPE) {
    next[type] = queue[type].filter(predicate);
  }
  return next;
};

const removeCardFromQueues = (cardUUID: string, queue: Queue) =>
  filterQueue(queue, (item) => item.cardUUID !== cardUUID);

const removeStepFromQueues = (stepUuid: string, queue: Queue) =>
  filterQueue(queue, (item) => item.stepUuid !== stepUuid);

const findCardUUIDForStep = (
  queue: Queue,
  stepUuid: string,
): string | undefined => {
  for (const type of EVERY_QUEUE_TYPE) {
    const match = queue[type].find((item) => item.stepUuid === stepUuid);
    if (match) {
      return match.cardUUID;
    }
  }
  return undefined;
};

const hasPendingStepsForCard = (queue: Queue, cardUUID?: string) => {
  if (!cardUUID) {
    return false;
  }
  return EVERY_QUEUE_TYPE.some((type) =>
    queue[type].some((item) => item.cardUUID === cardUUID),
  );
};

function getItemsDue(queue: Queue): number {
  return EVERY_QUEUE_TYPE.reduce(
    (acc, type) => acc + queue[type].length,
    0,
  );
}

function parseTakeParam(raw: string | null): number {
  if (!raw) {
    return DEFAULT_TAKE;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_TAKE;
  }
  return Math.min(Math.max(parsed, MIN_TAKE), MAX_TAKE);
}

function getTakeFromLocation(): number {
  if (typeof window === "undefined") {
    return DEFAULT_TAKE;
  }
  const urlParams = new URLSearchParams(window.location.search);
  return parseTakeParam(urlParams.get("take"));
}

function calculateProgressPercent(params: {
  initialSteps: number;
  remainingSteps: number;
}): number {
  if (params.initialSteps <= 0) {
    return 0;
  }
  return (
    ((params.initialSteps - params.remainingSteps) / params.initialSteps) *
    100
  );
}

function findCardUUIDByCardId(
  cards: State["cards"],
  cardId: number,
): string | undefined {
  return Object.values(cards).find((card) => card.cardId === cardId)?.uuid;
}

function completeCardInState(state: State, cardUUID: string): State {
  const updatedQueue = removeCardFromQueues(cardUUID, state.queue);
  return {
    ...state,
    queue: updatedQueue,
    currentItem: nextQueueItem(updatedQueue),
    completedCards: new Set([...state.completedCards, cardUUID]),
  };
}

export function nextQueueItem(queue: Queue): QueueItem | undefined {
  for (const type of EVERY_QUEUE_TYPE) {
    const item = queue[type][0];
    if (item) {
      return item;
    }
  }
  return undefined;
}

function initialState(): State {
  return {
    queue: createEmptyQueue(),
    cards: {},
    currentItem: undefined,
    gradingResults: {},
    initialCardCount: 0,
    initialStepCount: 0,
    completedCards: new Set(),
  };
}

function completeStep(stepUuid: string, state: State): State {
  const cardUUID = findCardUUIDForStep(state.queue, stepUuid);
  const queueWithoutStep = removeStepFromQueues(stepUuid, state.queue);
  const isCardDone = !hasPendingStepsForCard(queueWithoutStep, cardUUID);

  return {
    ...state,
    queue: queueWithoutStep,
    currentItem: nextQueueItem(queueWithoutStep),
    completedCards:
      isCardDone && cardUUID
        ? new Set([...state.completedCards, cardUUID])
        : state.completedCards,
  };
}

export function useReview(deckId: number) {
  const mutation = trpc.getNextQuizzes.useMutation();
  const repairCardMutation = trpc.editCard.useMutation();
  const [state, dispatch] = useReducer(reducer, initialState());
  const [isFetching, setIsFetching] = useState(true);
  const userSettings = useUserSettings();
  const take = getTakeFromLocation();

  const fetchQuizzes = useCallback(
    async (currentDeckId: number) => {
      setIsFetching(true);
      try {
        const fetchedData = await mutation.mutateAsync({
          take,
          deckId: currentDeckId,
        });
        dispatch({
          type: "REPLACE_CARDS",
          payload: fetchedData.quizzes.map((quiz) => ({
            ...quiz,
            uuid: uid(8),
          })),
        });
      } finally {
        setIsFetching(false);
      }
    },
    [mutation, take],
  );

  useEffect(() => {
    if (!deckId) {
      return;
    }
    void fetchQuizzes(deckId);
  }, [deckId, fetchQuizzes]);

  const remainingSteps = getItemsDue(state.queue);
  const progress = calculateProgressPercent({
    initialSteps: state.initialStepCount,
    remainingSteps,
  });

  return {
    error: mutation.isError ? mutation.error : null,
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
      if (card) {
        await playTermThenDefinition(card, userSettings.playbackSpeed);
      }
      dispatch({ type: "GIVE_UP", payload: { cardUUID } });
    },
    completeItem: (uuid: string) => {
      dispatch({ type: "COMPLETE_ITEM", payload: { uuid } });
    },
    onGradingResultCaptured: async (
      cardUUID: string,
      result: GradingResult,
    ) => {
      const card = state.cards[cardUUID];
      if (result.isCorrect && card?.lessonType === "remedial") {
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
      void fetchQuizzes(deckId);
    },
    updateCardFields: (
      cardId: number,
      updates: { term: string; definition: string },
    ) => {
      const cardUUID = findCardUUIDByCardId(state.cards, cardId);
      if (!cardUUID) {
        return;
      }
      dispatch({
        type: "UPDATE_CARD",
        payload: {
          cardUUID,
          term: updates.term,
          definition: updates.definition,
        },
      });
    },
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "REPLACE_CARDS": {
      const newState = replaceCards(action, state);
      return {
        ...newState,
        initialCardCount: Object.keys(newState.cards).length,
        initialStepCount: getItemsDue(newState.queue),
        completedCards: new Set(),
      };
    }
    case "SKIP_CARD":
      return completeCardInState(state, action.payload.uuid);
    case "COMPLETE_ITEM":
      return completeStep(action.payload.uuid, state);
    case "GIVE_UP": {
      return completeCardInState(state, action.payload.cardUUID);
    }
    case "STORE_GRADE_RESULT":
      return {
        ...state,
        gradingResults: {
          ...state.gradingResults,
          [action.payload.cardUUID]: action.payload.result,
        },
      };
    case "UPDATE_CARD": {
      const target = state.cards[action.payload.cardUUID];
      if (!target) {
        return state;
      }
      return {
        ...state,
        cards: {
          ...state.cards,
          [action.payload.cardUUID]: {
            ...target,
            term: action.payload.term ?? target.term,
            definition: action.payload.definition ?? target.definition,
          },
        },
      };
    }
    default:
      return state;
  }
}
