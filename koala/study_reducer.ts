import { unique } from "radash";

export type Quiz = {
  lessonType: "listening" | "speaking";
  definition: string;
  term: string;
  audio: string;
  cardId: number;
  lapses: number;
  quizId: number;
  repetitions: number;
  langCode: string;
};

export type Failure = {
  id: number;
  cardId: number;
  definition: string;
  lessonType: string;
  rejectionText: string;
  term: string;
  userTranscription: string;
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
  cardsById: Record<string, Quiz>;
  failures: Failure[];
  isRecording: boolean;
  idsAwaitingGrades: number[];
  idsWithErrors: number[];
  quizIDsForLesson: number[];
  newCards: number;
  quizzesDue: number;
  totalCards: number;
  currentItem: CurrentItem;
};

type QuizResult = "error" | "fail" | "pass";

export type Action =
  | { type: "DID_GRADE"; id: number; result: QuizResult }
  | { type: "FLAG_QUIZ"; cardId: number }
  | { type: "ADD_FAILURE"; value: Failure }
  | { type: "REMOVE_FAILURE"; id: number }
  | { type: "BEGIN_RECORDING" }
  | { type: "USER_GAVE_UP"; id: number }
  | { type: "END_RECORDING"; id: number }
  | {
      type: "ADD_MORE";
      quizzes: Quiz[];
      totalCards: number;
      quizzesDue: number;
      newCards: number;
    };

// Creates a unique array of numbers but keeps the head
// in the 0th position to avoid changing the current quiz.
function betterUnique(input: number[]): number[] {
  if (input.length < 2) {
    return input;
  }
  const [head, ...tail] = input;
  return [head, ...unique(tail.filter((x) => x !== head))];
}

export function gotoNextQuiz(state: State): State {
  console.log("=== Changing quizzes ===");
  if (state.isRecording) {
    throw new Error("Cannot change quizzes while recording");
  }

  const [nextFailure, ...restFailures] = state.failures;
  if (nextFailure) {
    return {
      ...state,
      currentItem: { type: "failure", value: nextFailure },
      failures: restFailures,
    };
  }
  const [nextQuizID, ...restQuizIDs] = state.quizIDsForLesson;
  const nextQuiz = state.cardsById[nextQuizID];
  if (nextQuiz) {
    return {
      ...state,
      currentItem: { type: "quiz", value: nextQuiz },
      quizIDsForLesson: betterUnique([...restQuizIDs, nextQuizID]),
    };
  }
  return {
    ...state,
    currentItem: { type: "none", value: undefined },
  };
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
            userTranscription: "Empty response",
            rejectionText: "You hit the `Fail` button. Better luck next time!",
            rollbackData: undefined,
          },
          ...state.failures,
        ],
      });
      return removeCard(state2, action.id);
    case "FLAG_QUIZ":
      return gotoNextQuiz(state);
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
