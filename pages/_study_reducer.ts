import { playAudio } from "@/components/play-button";

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
  quizIDsForLesson: number[];
  phrasesById: Record<string, Quiz>;
};

type LessonType = keyof Quiz["audio"];

type QuizResult = "error" | "failure" | "success";

type Action =
  | { type: "WILL_GRADE" }
  | { type: "USER_GAVE_UP"; id: number }
  | { type: "FLAG_QUIZ"; id: number }
  | { type: "DID_GRADE"; id: number; result: QuizResult };

export type CurrentQuiz = {
  id: number;
  en: string;
  ko: string;
  quizAudio: string;
  lessonType: "dictation" | "speaking" | "listening";
  repetitions: number;
};

export function gotoNextQuiz(state: State): State {
  const currentQuizIndex = state.currentQuizIndex + 1;
  return { ...state, currentQuizIndex };
}

export const newQuizState = (state: Partial<State> = {}): State => {
  const phrasesById = state.phrasesById || {};
  const remainingQuizIDs = Object.keys(phrasesById).map((x) => parseInt(x));
  return {
    currentQuizIndex: 0,
    numQuizzesAwaitingServerResponse: 0,
    phrasesById,
    quizIDsForLesson: remainingQuizIDs,
    errors: [],
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
    lessonType = quiz.id + (quiz.repetitions % 2) ? "listening" : "speaking";
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

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case "USER_GAVE_UP":
    case "FLAG_QUIZ":
      const filter = (id: number) => id !== action.id;
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
      return gotoNextQuiz({
        ...state,
        numQuizzesAwaitingServerResponse,
      });
    default:
      console.warn("Unhandled action", action);
      return state;
  }
}

let lastQuizAndLesson = `None + None`;

function temporaryWorkaround(quiz: CurrentQuiz | undefined) {
  if (!quiz) return;
  const nextQuizAndLesson = `${quiz.id || "None"} + ${
    quiz.lessonType || "None"
  }`;
  if (nextQuizAndLesson !== lastQuizAndLesson) {
    playAudio(quiz.quizAudio);
    lastQuizAndLesson = nextQuizAndLesson;
  }
}

export function quizReducer(state: State, action: Action): State {
  const nextState = reduce(state, action);
  temporaryWorkaround(currentQuiz(nextState));
  return nextState;
}
