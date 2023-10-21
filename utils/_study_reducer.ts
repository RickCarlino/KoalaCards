export type Quiz = {
  id: number;
  ko: string;
  en: string;
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
  ko: string;
  en: string;
  lessonType: string;
  userTranscription: string;
  rejectionText: string;
};

type State = {
  numQuizzesAwaitingServerResponse: number;
  errors: string[];
  quizIDsForLesson: number[];
  phrasesById: Record<string, Quiz>;
  isRecording: boolean;
  failure: Failure | null;
  totalCards: number;
  quizzesDue: number;
  newCards: number;
};

type LessonType = keyof Quiz["audio"];

type QuizResult = "error" | "failure" | "success";

type Action =
  | { type: "WILL_GRADE"; id: number }
  | { type: "USER_GAVE_UP"; id: number }
  | { type: "FLAG_QUIZ"; id: number }
  | { type: "DID_GRADE"; id: number; result: QuizResult }
  | { type: "SET_RECORDING"; value: boolean }
  | { type: "SET_FAILURE"; value: null | Failure }
  | {
      type: "ADD_MORE";
      quizzes: Quiz[];
      totalCards: number;
      quizzesDue: number;
      newCards: number;
    };

export type CurrentQuiz = {
  id: number;
  en: string;
  ko: string;
  quizAudio: string;
  lessonType: "dictation" | "speaking" | "listening";
  repetitions: number;
  lapses: number;
};

export function gotoNextQuiz(state: State): State {
  const quizIDsForLesson = [...state.quizIDsForLesson.slice(1)];
  return { ...state, quizIDsForLesson };
}

export const newQuizState = (state: Partial<State> = {}): State => {
  const phrasesById = state.phrasesById || {};
  const remainingQuizIDs = Object.keys(phrasesById).map((x) => parseInt(x));
  return {
    numQuizzesAwaitingServerResponse: 0,
    phrasesById,
    quizIDsForLesson: remainingQuizIDs,
    errors: [],
    isRecording: false,
    failure: null,
    totalCards: 0,
    quizzesDue: 0,
    newCards: 0,
    ...state,
  };
};

export function currentQuiz(state: State): CurrentQuiz | undefined {
  const quizID = state.quizIDsForLesson[0];
  const quiz = state.phrasesById[quizID];
  if (!quiz) {
    console.log("=== No quiz found for quizID " + (quizID ?? "null"));
    return undefined;
  }
  let lessonType: LessonType;
  // TODO: Calculating the lessonType on the frontend no longer
  // makes sense and is an artifact of a previous architecture.
  // In the future we should calculate this on the backend and only
  // send audio for the appropriate quiz.
  const PROGRESSION: LessonType[] = ["dictation", "dictation", "listening"];
  const progression = PROGRESSION[quiz.repetitions];
  if (progression) {
    lessonType = progression;
  } else {
    // After the nth repetition, the lessonType
    // oscillates between listening and speaking.
    const nonce = quiz.id + quiz.repetitions;
    const x = nonce % 2;
    lessonType = x === 0 ? "listening" : "speaking";
  }
  return {
    id: quiz.id,
    en: quiz.en,
    ko: quiz.ko,
    quizAudio: quiz.audio[lessonType],
    lessonType,
    repetitions: quiz.repetitions,
    lapses: quiz.lapses,
  };
}

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case "SET_FAILURE":
      return {
        ...state,
        failure: action.value,
      };
    case "SET_RECORDING":
      return {
        ...state,
        isRecording: action.value,
      };
    case "USER_GAVE_UP":
      const nextState = gotoNextQuiz(state);
      const card = state.phrasesById[action.id];
      return {
        ...nextState,
        failure: {
          id: action.id,
          ko: card.ko,
          en: card.en,
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
      let numQuizzesAwaitingServerResponse =
        state.numQuizzesAwaitingServerResponse - 1;
      return gotoNextQuiz({
        ...state,
        numQuizzesAwaitingServerResponse,
      });
    case "ADD_MORE":
      const nextQuizIDsForLesson = [
        ...state.quizIDsForLesson,
        ...action.quizzes.map((x) => x.id),
      ];

      const nextphrasesById: Record<string, Quiz> = action.quizzes.reduce(
        (acc, x) => {
          acc[x.id] = x;
          return acc;
        },
        {} as Record<string, Quiz>,
      );

      nextQuizIDsForLesson.forEach((id) => {
        nextphrasesById[id] ??= state.phrasesById[id];
      });

      return {
        ...state,
        phrasesById: nextphrasesById,
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
