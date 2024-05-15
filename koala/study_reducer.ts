import { unique } from "radash";
import { LessonType, QuizResult } from "./shared-types";

export type Quiz = {
  lessonType: LessonType;
  definition: string;
  term: string;
  audio: string;
  cardId: number;
  lapses: number;
  quizId: number;
  repetitions: number;
  langCode: string;
  lastReview: number;
  imageURL?: string;
};

export type Failure = {
  id: number;
  cardId: number;
  definition: string;
  lessonType: string;
  rejectionText: string;
  term: string;
  userTranscription: string;
  playbackAudio: string;
  rollbackData?: {
    difficulty: number;
    stability: number;
    nextReview: number;
  };
};

type CurrentItem =
  | { type: "quiz"; value: Quiz }
  | { type: "failure"; value: Failure }
  | { type: "loading"; value: undefined }
  | { type: "none"; value: undefined };

export type State = {
  isRecording: boolean;
  cardsById: Record<string, Quiz>;
  failures: Failure[];
  idsAwaitingGrades: number[];
  idsWithErrors: number[];
  quizIDsForLesson: number[];
  newCards: number;
  quizzesDue: number;
  totalCards: number;
  currentItem: CurrentItem;
  failureReviewMode: boolean;
  totalComplete: number;
  totalFailed: number;
};

export type Action =
  | { type: "DID_GRADE"; id: number; result: QuizResult }
  | { type: "FLAG_QUIZ"; cardId: number }
  | { type: "ADD_FAILURE"; value: Failure }
  | { type: "REMOVE_FAILURE"; id: number }
  | { type: "BEGIN_RECORDING" }
  | { type: "USER_GAVE_UP"; id: number; playbackAudio: string }
  | { type: "END_RECORDING"; id: number }
  | {
      type: "ADD_MORE";
      quizzes: Quiz[];
      totalCards: number;
      quizzesDue: number;
      newCards: number;
    };

export const YOU_HIT_FAIL = "You hit fail";

// Creates a unique array of numbers but keeps the head
// in the 0th position to avoid changing the current quiz.
function betterUnique(input: number[]): number[] {
  if (input.length < 2) {
    return input;
  }
  const [head, ...tail] = input;
  return [head, ...unique(tail.filter((x) => x !== head))];
}

const FAILURE_REVIEW_CUTOFF = 1;

function maybeEnterFailureReview(state: State): State {
  // Reasons to enter failure mode:
  // 1. There are > FAILURE_REVIEW_CUTOFF failures to review.
  // 2. There are no more quizzes to review.

  const lotsOfFailures = state.failures.length >= FAILURE_REVIEW_CUTOFF;
  const anyFailures = state.failures.length > 0;
  const noQuizzes = !state.cardsById[state.quizIDsForLesson[0]];
  if (lotsOfFailures || (anyFailures && noQuizzes)) {
    return {
      ...state,
      failureReviewMode: true,
    };
  }

  return state;
}

function maybeExitFailureReview(state: State): State {
  // Reasons to exit failure mode:
  // 1. There are no more failures to review.

  if (state.failures.length === 0) {
    return {
      ...state,
      failureReviewMode: false,
    };
  }
  return state;
}

export function gotoNextQuiz(oldState: State): State {
  if (oldState.isRecording) {
    throw new Error("Cannot change quizzes while recording");
  }

  const state = maybeEnterFailureReview(oldState);

  const [nextFailure, ...restFailures] = state.failures;
  if (nextFailure && state.failureReviewMode) {
    return maybeExitFailureReview({
      ...state,
      currentItem: { type: "failure", value: nextFailure },
      quizIDsForLesson: betterUnique(state.quizIDsForLesson),
      failures: restFailures,
    });
  }
  const [nextQuizID, ...restQuizIDs] = state.quizIDsForLesson;
  const nextQuiz = state.cardsById[nextQuizID];
  if (nextQuiz) {
    return maybeExitFailureReview({
      ...state,
      currentItem: { type: "quiz", value: nextQuiz },
      quizIDsForLesson: betterUnique([...restQuizIDs, nextQuizID]),
    });
  }
  return maybeExitFailureReview({
    ...state,
    currentItem: { type: "none", value: undefined },
  });
}

export const newQuizState = (state: Partial<State> = {}): State => {
  const cardsById = state.cardsById || {};
  const remainingQuizIDs = Object.keys(cardsById).map((x) => parseInt(x));
  return {
    /** Re-trying a quiz after an error is distracting.
     * Instead of re-quizzing on errors, we just remove them
     * from the lesson. */
    idsWithErrors: [],
    idsAwaitingGrades: [],
    failures: [],
    cardsById,
    quizIDsForLesson: remainingQuizIDs,
    isRecording: false,
    totalCards: 0,
    quizzesDue: 0,
    newCards: 0,
    currentItem: { type: "loading", value: undefined },
    failureReviewMode: false,
    totalComplete: 0,
    totalFailed: 0,
    ...state,
  };
};

function removeCard(oldState: State, id: number): State {
  let quizIDsForLesson = oldState.quizIDsForLesson.filter((x) => x !== id);
  let cardsById: State["cardsById"] = {};
  const old = oldState.cardsById;
  // A mark-and-sweep garbage collector of sorts.
  quizIDsForLesson.forEach((id) => {
    cardsById[id] = old[id];
  });
  oldState.failures.forEach((failure) => {
    cardsById[failure.id] = old[failure.id];
  });
  return {
    ...oldState,
    quizIDsForLesson,
    cardsById,
  };
}

function reduce(state: State, action: Action): State {
  console.log(action);
  switch (action.type) {
    case "ADD_FAILURE":
      return {
        ...state,
        failures: [...state.failures, action.value],
      };
    case "REMOVE_FAILURE":
      return gotoNextQuiz({
        ...state,
        failures: state.failures.filter((x) => x.id !== action.id),
      });
    case "BEGIN_RECORDING":
      return {
        ...state,
        isRecording: true,
      };
    case "USER_GAVE_UP":
      const curr = state.currentItem;
      if (curr.type !== "quiz") {
        throw new Error("Expected a quiz");
      }
      const card = curr.value;
      const state2 = gotoNextQuiz({
        ...state,
        failures: [
          {
            id: action.id,
            cardId: card.cardId,
            term: card.term,
            definition: card.definition,
            lessonType: card.lessonType,
            userTranscription: YOU_HIT_FAIL,
            rejectionText: YOU_HIT_FAIL,
            playbackAudio: action.playbackAudio,
            rollbackData: undefined,
          },
          ...state.failures,
        ],
      });
      return removeCard(state2, action.id);
    case "FLAG_QUIZ":
      const filter = (quizID: number) =>
        state.cardsById[quizID]?.cardId !== action.cardId;
      return gotoNextQuiz({
        ...state,
        // Remove all quizzes with this cardID
        quizIDsForLesson: state.quizIDsForLesson.filter(filter),
      });
    case "END_RECORDING":
      const arr = [...state.idsAwaitingGrades, action.id];
      const set = new Set(arr);
      return gotoNextQuiz({
        ...state,
        isRecording: false,
        idsAwaitingGrades: arr,
        failures: state.failures.filter((x) => !set.has(x.id)),
        quizIDsForLesson: state.quizIDsForLesson.filter((x) => !set.has(x)),
      });
    case "DID_GRADE":
      const idsAwaitingGrades: number[] = [];
      state.idsAwaitingGrades.forEach((id) => {
        if (id !== action.id) {
          idsAwaitingGrades.push(id);
        }
      });
      const isError = action.result === "error";
      const idsWithErrors: number[] = isError
        ? [...state.idsWithErrors, action.id]
        : state.idsWithErrors;
      return {
        ...removeCard(state, action.id),
        idsAwaitingGrades,
        idsWithErrors,
        totalFailed: state.totalFailed + (action.result === "fail" ? 1 : 0),
        totalComplete: state.totalComplete + 1,
      };
    case "ADD_MORE":
      const newStuff = action.quizzes.map((x) => x.quizId);
      const oldStuff = state.quizIDsForLesson;
      const nextQuizIDsForLesson = betterUnique([...oldStuff, ...newStuff]);
      const nextcardsById: Record<string, Quiz> = {};
      nextQuizIDsForLesson.forEach((id) => {
        nextcardsById[id] ??= state.cardsById[id];
      });
      action.quizzes.forEach((card) => {
        nextcardsById[card.quizId] ??= card;
      });
      return {
        ...state,
        cardsById: nextcardsById,
        quizIDsForLesson: nextQuizIDsForLesson,
        totalCards: action.totalCards,
        quizzesDue: action.quizzesDue,
        newCards: action.newCards,
      };
    default:
      console.warn("Unhandled action", action);
      return state;
  }
}

export function quizReducer(state: State, action: Action): State {
  const nextState = reduce(state, action);
  return nextState;
}
