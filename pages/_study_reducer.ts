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
  currentQuizIndex: number;
  pendingQuizzes: number;
  failedQuizzes: Set<number>;
  currentQuizType: QuizType;
  quizzes: Quiz[];
  errors: string[];
};

type QuizType = "dictation" | "listening" | "speaking";

type Action =
  | { type: "START_QUIZ" }
  | { type: "NEXT_QUIZ" }
  | { type: "FAIL_QUIZ"; id: number }
  | { type: "FLAG_QUIZ"; id: number }
  | { type: "WILL_GRADE" }
  | { type: "ADD_ERROR"; message: string }
  | { type: "DID_GRADE"; id: number; result: "error" | "failure" | "success" }
  | { type: "SET_QUIZ_TYPE"; quizType: QuizType };

function gotoNextQuiz(state: State): State {
  const findFailedQuiz = (quiz: Quiz) => state.failedQuizzes.has(quiz.id);
  let nextQuizIndex =
    state.failedQuizzes.size > 0
      ? state.quizzes.findIndex(findFailedQuiz)
      : state.currentQuizIndex + 1;

  let nextQuizType = state.currentQuizType;
  if (nextQuizIndex >= state.quizzes.length) {
    if (state.currentQuizType === "dictation") {
      nextQuizType = "listening";
    } else if (state.currentQuizType === "listening") {
      nextQuizType = "speaking";
    }
    nextQuizIndex = 0;
  }

  return {
    ...state,
    currentQuizIndex: nextQuizIndex,
    currentQuizType: nextQuizType,
  };
}

export const newQuizState = (state: Partial<State> = {}): State => {
  return {
    currentQuizIndex: 0,
    pendingQuizzes: 0,
    failedQuizzes: new Set(),
    currentQuizType: "dictation",
    quizzes: [],
    errors: [],
    ...state,
  };
};

export type CurrentQuiz = {
  id: number;
  en: string;
  ko: string;
  quizAudio: string;
  quizType: "dictation" | "speaking" | "listening";
};

export function currentQuiz(state: State): CurrentQuiz {
  const currentQuiz = state.quizzes[state.currentQuizIndex];
  const quizType = state.currentQuizType;

  return {
    id: currentQuiz.id,
    en: currentQuiz.en,
    ko: currentQuiz.ko,
    quizAudio: currentQuiz.audio[quizType],
    quizType,
  };
}

export function quizReducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_ERROR":
      return { ...state, errors: [...state.errors, action.message] };

    case "START_QUIZ":
      return newQuizState();

    case "NEXT_QUIZ":
      return gotoNextQuiz(state);

    case "FAIL_QUIZ":
      const newFailedQuizzes = new Set(state.failedQuizzes);
      newFailedQuizzes.add(action.id);
      return gotoNextQuiz({ ...state, failedQuizzes: newFailedQuizzes });

    case "FLAG_QUIZ":
      const filter = (quiz: { id: number }) => quiz.id !== action.id;
      const updatedQuizzes = state.quizzes.filter(filter);
      return gotoNextQuiz({ ...state, quizzes: updatedQuizzes });

    case "WILL_GRADE":
      return { ...state, pendingQuizzes: state.pendingQuizzes + 1 };

    case "DID_GRADE":
      let updatedFailedQuizzes = state.failedQuizzes;
      if (action.result === "failure") {
        updatedFailedQuizzes.add(action.id);
      } else if (action.result === "success") {
        updatedFailedQuizzes.delete(action.id);
      }
      return gotoNextQuiz({
        ...state,
        pendingQuizzes: state.pendingQuizzes - 1,
        failedQuizzes: updatedFailedQuizzes,
      });

    case "SET_QUIZ_TYPE":
      return { ...state, currentQuizType: action.quizType };

    default:
      return state;
  }
}
