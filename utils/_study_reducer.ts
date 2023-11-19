export type Quiz = {
  id: number;
  term: string;
  definition: string;
  repetitions: number;
  lapses: number;
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
  errors: string[];
  quizIDsForLesson: number[];
  cardsById: Record<string, Quiz>;
  isRecording: boolean;
  failure: Failure | null;
  totalCards: number;
  quizzesDue: number;
  newCards: number;
  listeningPercentage: number;
  seed: number;
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
  const quizIDsForLesson = [...state.quizIDsForLesson.slice(1)];
  return {
    ...state,
    // Technically not a pure function if we use Math.random()
    // but I was not happy with pseudorandom number generators
    seed: Math.random(),
    quizIDsForLesson,
  };
}

export const newQuizState = (state: Partial<State> = {}): State => {
  const cardsById = state.cardsById || {};
  const remainingQuizIDs = Object.keys(cardsById).map((x) => parseInt(x));
  return {
    numQuizzesAwaitingServerResponse: 0,
    cardsById,
    quizIDsForLesson: remainingQuizIDs,
    errors: [],
    isRecording: false,
    failure: null,
    totalCards: 0,
    quizzesDue: 0,
    newCards: 0,
    listeningPercentage: 0.5,
    seed: Math.random(),
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
    const listening = state.seed < state.listeningPercentage;
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

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_FAILURE":
      return {
        ...state,
        failure: action.value,
      };
    case "REMOVE_FAILURE":
      return {
        ...state,
        failure: null,
      };
    case "SET_RECORDING":
      return {
        ...state,
        isRecording: action.value,
      };
    case "USER_GAVE_UP":
      const nextState = gotoNextQuiz(state);
      const card = state.cardsById[action.id];
      return {
        ...nextState,
        failure: {
          id: action.id,
          term: card.term,
          definition: card.definition,
          lessonType: currentQuiz(state)?.lessonType ?? "dictation",
          userTranscription: "Empty response",
          rejectionText: "You hit the `Fail` button. Better luck next time!",
        },
      };
    case "FLAG_QUIZ":
      return gotoNextQuiz(state);
    case "WILL_GRADE":
      return {
        ...state,
        numQuizzesAwaitingServerResponse:
          state.numQuizzesAwaitingServerResponse + 1,
      };
    case "DID_GRADE":
      let quizIDsForLesson = [...state.quizIDsForLesson];
      let cardsById = { ...state.cardsById };
      if (action.result === "error") {
        const id = action.id;
        console.log(`Need to remove ${id} from state tree:`);
        console.dir(state);
        delete cardsById[id];
        quizIDsForLesson = quizIDsForLesson.filter((x) => x !== id);
      }
      let numQuizzesAwaitingServerResponse =
        state.numQuizzesAwaitingServerResponse - 1;
      return gotoNextQuiz({
        ...state,
        numQuizzesAwaitingServerResponse,
        quizIDsForLesson,
        cardsById,
      });
    case "ADD_MORE":
      const newStuff = action.quizzes.map((x) => x.id);
      const oldStuff = state.quizIDsForLesson;
      const nextQuizIDsForLesson = [...oldStuff, ...newStuff];
      const nextcardsById: Record<string, Quiz> = action.quizzes.reduce(
        (acc, x) => {
          acc[x.id] = x;
          return acc;
        },
        {} as Record<string, Quiz>,
      );

      nextQuizIDsForLesson.forEach((id) => {
        nextcardsById[id] ??= state.cardsById[id];
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
