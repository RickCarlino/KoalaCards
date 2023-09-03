import { playAudio } from "@/components/play-button";
import { shuffle } from "radash";

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
  currentLessonType: LessonType;
  errors: string[];
  quizIDsForLesson: string[];
  failedQuizzes: Set<string>;
  phrasesById: Record<string, Quiz>;
};

type LessonType = "dictation" | "listening" | "speaking";

type QuizResult = "error" | "failure" | "success";

type Action =
  | { type: "WILL_GRADE" }
  | { type: "ADD_ERROR"; message: string }
  | { type: "FAIL_QUIZ"; id: string }
  | { type: "FLAG_QUIZ"; id: string }
  | { type: "DID_GRADE"; id: string; result: QuizResult };

const proceedToNextLessonType = (state: State): State => {
  let remainingQuizIDs = state.quizIDsForLesson;
  let currentLessonType = state.currentLessonType;
  remainingQuizIDs = shuffle(
    Object.keys(state.phrasesById).filter((id) => {
      return !state.failedQuizzes.has(id);
    }),
  );
  switch (currentLessonType) {
    case "dictation":
      currentLessonType = "listening";
      break;
    case "listening":
      currentLessonType = "speaking";
      break;
    case "speaking":
      // TODO We could potentially restart quizzes here for
      //      second round (failed items only).
      remainingQuizIDs = []; // No more quizzes
      break;
    default:
      throw new Error("Invalid quizType");
  }
  return {
    ...state,
    currentLessonType: currentLessonType,
    quizIDsForLesson: remainingQuizIDs,
    currentQuizIndex: 0,
  };
};

export function gotoNextQuiz(state: State): State {
  let nextQuizIndex = state.currentQuizIndex + 1;
  let nextID = state.quizIDsForLesson[nextQuizIndex];

  // If the current quiz type is "dictation", check for repetitions count < 3
  if (state.currentLessonType === "dictation") {
    while (nextID && state.phrasesById[nextID].repetitions > 3) {
      nextQuizIndex++;
      nextID = state.quizIDsForLesson[nextQuizIndex];
    }
  }

  let nextState: State;
  if (nextID) {
    nextState = { ...state, currentQuizIndex: nextQuizIndex };
  } else {
    nextState = proceedToNextLessonType(state);
  }

  return nextState;
}

export const newQuizState = (state: Partial<State> = {}): State => {
  const phrasesById = state.phrasesById || {};
  const remainingQuizIDs = Object.keys(phrasesById);
  return {
    currentLessonType: "dictation",
    currentQuizIndex: 0,
    numQuizzesAwaitingServerResponse: 0,
    phrasesById,
    quizIDsForLesson: remainingQuizIDs,
    errors: [],
    failedQuizzes: new Set(),
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

export function currentQuiz(state: State): CurrentQuiz | undefined {
  const quizID = state.quizIDsForLesson[state.currentQuizIndex];
  const quizType = state.currentLessonType;
  const quiz = state.phrasesById[quizID];
  return (
    quiz && {
      id: quiz.id,
      en: quiz.en,
      ko: quiz.ko,
      quizAudio: quiz.audio[quizType],
      quizType,
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
      }
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
            quizIDsForLesson: [
              ...state.quizIDsForLesson,
              action.id,
            ]
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
