import { unique } from "radash";

export type Quiz = {
  quizId: number;
  term: string;
  definition: string;
  repetitions: number;
  lapses: number;
  lessonType: "listening" | "speaking";
  audio: string;
};

type Failure = {
  id: number;
  term: string;
  definition: string;
  lessonType: string;
  userTranscription: string;
  rejectionText: string;
  previousSpacingData?: {
    repetitions: number;
    interval: number;
    ease: number;
    lapses: number;
  };
};

export type State = {
  idsAwaitingGrades: number[];
  quizIDsForLesson: number[];
  idsWithErrors: number[];
  cardsById: Record<string, Quiz>;
  isRecording: boolean;
  failures: Failure[];
  totalCards: number;
  quizzesDue: number;
  newCards: number;
  listeningPercentage: number;
};

type QuizResult = "error" | "failure" | "success";

export type Action =
  | { type: "DID_GRADE"; id: number; result: QuizResult }
  | { type: "FLAG_QUIZ"; id: number }
  | { type: "ADD_FAILURE"; value: Failure }
  | { type: "REMOVE_FAILURE"; id: number }
  | { type: "SET_RECORDING"; value: boolean }
  | { type: "USER_GAVE_UP"; id: number }
  | { type: "WILL_GRADE"; id: number }
  | {
      type: "ADD_MORE";
      quizzes: Quiz[];
      totalCards: number;
      quizzesDue: number;
      newCards: number;
    };

export type CurrentQuiz = {
  id: number;
  definition: string;
  term: string;
  quizAudio: string;
  lessonType: "speaking" | "listening";
  repetitions: number;
  lapses: number;
};

const stats = {
  count: {
    listening: 0,
    speaking: 0,
  },
  win: {
    listening: 0,
    speaking: 0,
  },
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
  return {
    ...state,
    quizIDsForLesson: betterUnique([...state.quizIDsForLesson.slice(1)]),
  };
}

export const newQuizState = (state: Partial<State> = {}): State => {
  const cardsById = state.cardsById || {};
  const remainingQuizIDs = Object.keys(cardsById).map((x) => parseInt(x));
  return {
    idsAwaitingGrades: [],
    failures: [],
    /** Re-trying a quiz after an error is distracting.
     * Instead of re-quizzing on errors, we just remove them
     * from the lesson. */
    idsWithErrors: [],
    cardsById,
    quizIDsForLesson: remainingQuizIDs,
    isRecording: false,
    totalCards: 0,
    quizzesDue: 0,
    newCards: 0,
    listeningPercentage: 0.5,
    ...state,
  };
};

export function currentQuiz(state: State): CurrentQuiz | undefined {
  const quizID = state.quizIDsForLesson[0];
  const quiz = state.cardsById[quizID];
  if (!quiz) {
    return undefined;
  }

  return {
    id: quiz.quizId,
    definition: quiz.definition,
    term: quiz.term,
    quizAudio: quiz.audio,
    lessonType: quiz.lessonType,
    repetitions: quiz.repetitions,
    lapses: quiz.lapses,
  };
}

function removeCard(oldState: State, id: number): State {
  let quizIDsForLesson = oldState.quizIDsForLesson.filter((x) => x !== id);
  let cardsById: State["cardsById"] = {};
  // A mark-and-sweep garbage collector of sorts.
  quizIDsForLesson.forEach((id) => {
    cardsById[id] = oldState.cardsById[id];
  });
  oldState.failures.forEach((failure) => {
    cardsById[failure.id] = oldState.cardsById[failure.id];
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
      return {
        ...state,
        failures: state.failures.filter((x) => x.id !== action.id),
      };
    case "SET_RECORDING":
      return {
        ...state,
        isRecording: action.value,
      };
    case "USER_GAVE_UP":
      const y = currentQuiz(state);
      if (y) {
        stats.count[y.lessonType] += 1;
      }
      const nextState = gotoNextQuiz(state);
      const card = state.cardsById[action.id];
      const state2 = {
        ...nextState,
        failures: [
          {
            id: action.id,
            term: card.term,
            definition: card.definition,
            lessonType: currentQuiz(state)?.lessonType ?? "listening",
            userTranscription: "Empty response",
            rejectionText: "You hit the `Fail` button. Better luck next time!",
          },
          ...state.failures,
        ],
      };
      return removeCard(state2, action.id);
    case "FLAG_QUIZ":
      return gotoNextQuiz(state);
    case "WILL_GRADE":
      return gotoNextQuiz({
        ...state,
        idsAwaitingGrades: [action.id, ...state.idsAwaitingGrades],
      });
    case "DID_GRADE":
      const x = currentQuiz(state);
      if (x) {
        stats.count[x.lessonType] += 1;
        if (action.result === "success") {
          stats.win[x.lessonType] += 1;
        }
        const keys: (keyof typeof stats.count)[] = [
          "listening",
          "speaking",
        ];
        keys.map((key) => {
          const win = stats.win[key];
          const count = stats.count[key];
          const percentage = win / count;
          console.log(
            `${key}: ${Math.round(percentage * 100) || 0}% of ${count}`,
          );
        });
      }
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
