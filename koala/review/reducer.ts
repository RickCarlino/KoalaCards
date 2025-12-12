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
  GradingResult,
} from "./types";
import { useUserSettings } from "@/koala/settings-provider";
import { playTermThenDefinition } from "./playback";

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

const cardHasPendingSteps = (queue: Queue, cardUUID?: string) =>
  Boolean(
    cardUUID &&
      EVERY_QUEUE_TYPE.some((type) =>
        queue[type].some((item) => item.cardUUID === cardUUID),
      ),
  );

function skipCard(action: SkipCardAction, state: State): State {
  const cardUUID = action.payload.uuid;
  const updatedQueue = removeCardFromQueues(cardUUID, state.queue);

  return {
    ...state,
    queue: updatedQueue,
    currentItem: nextQueueItem(updatedQueue),
  };
}

function getItemsDue(queue: Queue): number {
  return EVERY_QUEUE_TYPE.reduce(
    (acc, type) => acc + queue[type].length,
    0,
  );
}

export function nextQueueItem(queue: Queue): QueueItem | undefined {
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
  const isCardDone = !cardHasPendingSteps(queueWithoutStep, cardUUID);

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

  const urlParams = new URLSearchParams(window.location.search);
  const takeParam = urlParams.get("take");
  const take = takeParam
    ? Math.min(Math.max(parseInt(takeParam, 10), 1), 25)
    : 5;
  const fetchQuizzes = async (currentDeckId: number) => {
    setIsFetching(true);
    try {
      const fetchedData = await mutation.mutateAsync({
        take,
        deckId: currentDeckId,
      });
      const withUUID = fetchedData.quizzes.map((q) => ({
        ...q,
        uuid: uid(8),
      }));
      dispatch({ type: "REPLACE_CARDS", payload: withUUID });
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (deckId) {
      void fetchQuizzes(deckId);
    }
  }, [deckId]);

  const remainingSteps = getItemsDue(state.queue);
  const progress =
    state.initialStepCount > 0
      ? ((state.initialStepCount - remainingSteps) /
          state.initialStepCount) *
        100
      : 0;

  const findCardUUIDById = (cardId: number) =>
    Object.values(state.cards).find((card) => card.cardId === cardId)
      ?.uuid;

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
      void fetchQuizzes(deckId);
    },
    updateCardFields: (
      cardId: number,
      updates: { term: string; definition: string },
    ) => {
      const cardUUID = findCardUUIDById(cardId);
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
      return {
        ...skipCard(action, state),
        completedCards: new Set([
          ...state.completedCards,
          action.payload.uuid,
        ]),
      };
    case "COMPLETE_ITEM":
      return completeStep(action.payload.uuid, state);
    case "GIVE_UP": {
      const { cardUUID: giveUpCardUUID } = action.payload;
      const giveUpQueue = removeCardFromQueues(
        giveUpCardUUID,
        state.queue,
      );

      return {
        ...state,
        queue: giveUpQueue,
        currentItem: nextQueueItem(giveUpQueue),
        completedCards: new Set([...state.completedCards, giveUpCardUUID]),
      };
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
