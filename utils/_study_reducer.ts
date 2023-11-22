import { unique } from "radash";

export type Quiz = {
  id: number;
  term: string;
  definition: string;
  repetitions: number;
  lapses: number;
  randomSeed: number;
  audio: {
    dictation: string;
    listening: string;
    speaking: string;
  };
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

type State = {
  numQuizzesAwaitingServerResponse: number;
  quizIDsForLesson: number[];
  cardsById: Record<string, Quiz>;
  isRecording: boolean;
  failures: Failure[];
  totalCards: number;
  quizzesDue: number;
  newCards: number;
  listeningPercentage: number;
};

type LessonType = keyof Quiz["audio"];

type QuizResult = "error" | "failure" | "success";

type Action =
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
  lessonType: "dictation" | "speaking" | "listening";
  repetitions: number;
  lapses: number;
};

export function gotoNextQuiz(state: State): State {
  const count = state.quizIDsForLesson.length;
  const uniqCount = new Set(state.quizIDsForLesson).size;
  if (count !== uniqCount) {
    console.warn("=== duplicates detected in study queue. Is this the bug?");
  }
  const quizIDsForLesson = [...state.quizIDsForLesson.slice(1)];
  return { ...state, quizIDsForLesson };
}

export const newQuizState = (state: Partial<State> = {}): State => {
  const cardsById = state.cardsById || {};
  const remainingQuizIDs = Object.keys(cardsById).map((x) => parseInt(x));
  return {
    numQuizzesAwaitingServerResponse: 0,
    cardsById,
    quizIDsForLesson: remainingQuizIDs,
    isRecording: false,
    failures: [],
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
    console.log("=== No quiz found for quizID " + (quizID ?? "null"));
    return undefined;
  }
  let lessonType: LessonType;
  // // TODO: Calculating the lessonType on the frontend no longer
  // // makes sense and is an artifact of a previous architecture.
  // // In the future we should calculate this on the backend and only
  // // send audio for the appropriate quiz.
  if (quiz.repetitions) {
    const listening = quiz.randomSeed < state.listeningPercentage;
    lessonType = listening ? "listening" : "speaking";
  } else {
    lessonType = "dictation";
  }
  return {
    id: quiz.id,
    definition: quiz.definition,
    term: quiz.term,
    quizAudio: quiz.audio[lessonType],
    lessonType,
    repetitions: quiz.repetitions,
    lapses: quiz.lapses,
  };
}

function removeCard(oldState: State, id: number): State {
  let quizIDsForLesson = oldState.quizIDsForLesson.filter((x) => x !== id);
  let cardsById: State["cardsById"] = {}; // { ...state.cardsById };
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
      const nextState = gotoNextQuiz(state);
      const card = state.cardsById[action.id];
      const state2 = {
        ...nextState,
        failures: [
          ...state.failures,
          {
            id: action.id,
            term: card.term,
            definition: card.definition,
            lessonType: currentQuiz(state)?.lessonType ?? "dictation",
            userTranscription: "Empty response",
            rejectionText: "You hit the `Fail` button. Better luck next time!",
          },
        ],
      };
      return removeCard(state2, action.id);
    case "FLAG_QUIZ":
      return gotoNextQuiz(state);
    case "WILL_GRADE":
      return gotoNextQuiz({
        ...state,
        numQuizzesAwaitingServerResponse:
          state.numQuizzesAwaitingServerResponse + 1,
      });
    case "DID_GRADE":
      return {
        ...removeCard(state, action.id),
        numQuizzesAwaitingServerResponse:
          state.numQuizzesAwaitingServerResponse - 1,
      };
    case "ADD_MORE":
      const newStuff = action.quizzes.map((x) => x.id);
      const oldStuff = state.quizIDsForLesson;
      const [head, ...tail] = [...oldStuff, ...newStuff];
      const nextQuizIDsForLesson = [head, ...unique(tail)];
      const nextcardsById: Record<string, Quiz> = {};
      nextQuizIDsForLesson.forEach((id) => {
        nextcardsById[id] ??= state.cardsById[id];
      });
      action.quizzes.forEach((card) => {
        nextcardsById[card.id] ??= card;
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
  // Do debugging here:
  // console.log(action.type);
  return nextState;
}
