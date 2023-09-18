export type Quiz = {
  id: number;
  ko: string;
  en: string;
  repetitions: number;
  audio: {
    dictation: string;
    listening: string;
    speaking: string;
  };
};

type State = {
  numQuizzesAwaitingServerResponse: number;
  currentQuizIndex: number;
  errors: string[];
  quizIDsForLesson: string[];
  failedQuizzes: Set<string>;
  phrasesById: Record<string, Quiz>;
};

type LessonType = keyof Quiz["audio"];

type QuizResult = "error" | "failure" | "success";

type Action =
  | { type: "WILL_GRADE" }
  | { type: "ADD_ERROR"; message: string }
  | { type: "FAIL_QUIZ"; id: string }
  | { type: "FLAG_QUIZ"; id: string }
  | { type: "DID_GRADE"; id: string; result: QuizResult };

export type CurrentQuiz = {
  id: number;
  en: string;
  ko: string;
  quizAudio: string;
  lessonType: "dictation" | "speaking" | "listening";
  repetitions: number;
};

export function gotoNextQuiz(state: State): State {
  return {
    ...state,
    currentQuizIndex: state.currentQuizIndex + 1
  };
}

export const newQuizState = (state: Partial<State> = {}): State => {
  const phrasesById = state.phrasesById || {};
  const remainingQuizIDs = Object.keys(phrasesById);
  return {
    currentQuizIndex: 0,
    numQuizzesAwaitingServerResponse: 0,
    phrasesById,
    quizIDsForLesson: remainingQuizIDs,
    errors: [],
    failedQuizzes: new Set(),
    ...state,
  };
};

export function currentQuiz(state: State): CurrentQuiz | undefined {
  const quizID = state.quizIDsForLesson[state.currentQuizIndex];
  const quiz = state.phrasesById[quizID];
  if (!quiz) {
    return undefined;
  }
  let lessonType: LessonType;
  // TODO: Calculating the lessonType on the frontend no longer
  // makes sense and is an artifact of a previous architecture.
  // In the future we should calculate this on the backend and only
  // send audio for the appropriate quiz.
  if (quiz.repetitions < 2) {
    lessonType = "dictation";
  } else {
    lessonType = quiz.repetitions % 2 === 0 ? "listening" : "speaking";
  }
  return (
    quiz && {
      id: quiz.id,
      en: quiz.en,
      ko: quiz.ko,
      quizAudio: quiz.audio[lessonType],
      lessonType,
      repetitions: quiz.repetitions,
    }
  );
}

export function quizReducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_ERROR":
      return { ...state, errors: [...state.errors, action.message] };

    case "FAIL_QUIZ":
      // Add to failed quiz set.
      const failedQuizzes = new Set(state.failedQuizzes);
      failedQuizzes.add(action.id);
      // Remove from list of remaining quizzes.
      const remainingQuizIDs = state.quizIDsForLesson.filter(
        (id) => id !== action.id,
      );
      return gotoNextQuiz({
        ...state,
        failedQuizzes,
        quizIDsForLesson: remainingQuizIDs,
      });

    case "FLAG_QUIZ":
      const filter = (id: string) => id !== action.id;
      return gotoNextQuiz({
        ...state,
        quizIDsForLesson: state.quizIDsForLesson.filter(filter),
      });

    case "WILL_GRADE":
      return {
        ...state,
        numQuizzesAwaitingServerResponse:
          state.numQuizzesAwaitingServerResponse + 1,
      };

    case "DID_GRADE":
      let numQuizzesAwaitingServerResponse =
        state.numQuizzesAwaitingServerResponse - 1;
      const nextState = {
        ...state,
        numQuizzesAwaitingServerResponse,
      };
      switch (action.result) {
        case "failure":
          return gotoNextQuiz({
            ...nextState,
            failedQuizzes: new Set(state.failedQuizzes).add(action.id),
          });
        case "error":
          // In the case of a server error,
          // we push the quiz onto the end of the list
          // and try again later.
          return gotoNextQuiz({
            ...nextState,
            quizIDsForLesson: [...state.quizIDsForLesson, action.id],
          });
        case "success":
          return gotoNextQuiz({ ...nextState });
        default:
          throw new Error("Invalid quiz result " + action.result);
      }
    default:
      console.warn("Unhandled action", action);
      return state;
  }
}
