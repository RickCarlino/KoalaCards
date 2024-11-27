import { Grade } from "femto-fsrs";
import {
  Action,
  ReviewState,
  LoadQuizzesAction,
  SetGradeAction,
  ServerFeedbackAction,
  UpdateAudioUrlAction,
} from "./types";

function updateQuiz(state: ReviewState, quizId: number, updateFn: (quiz: any) => any): ReviewState {
  return {
    ...state,
    quizzes: state.quizzes.map((q) =>
      q.quiz.quizId === quizId ? updateFn(q) : q
    ),
  };
}

function handleLoadQuizzes(state: ReviewState, action: LoadQuizzesAction): ReviewState {
  return {
    ...state,
    quizzes: action.quizzes.map((quiz) => ({ quiz })),
    currentQuizIndex: 0,
  };
}

function handleSetGrade(state: ReviewState, action: SetGradeAction): ReviewState {
  return updateQuiz(state, action.quizId, (q) => ({
    ...q,
    grade: action.grade,
  }));
}

function handleServerFeedback(state: ReviewState, action: ServerFeedbackAction): ReviewState {
  return updateQuiz(state, action.quizId, (q) => ({
    ...q,
    serverGradingResult: action.result,
    serverResponse: action.serverResponse,
    status: "graded",
    grade: action.result === "fail" ? Grade.AGAIN : q.grade,
    response: action.userResponse,
  }));
}

function handleUpdateAudioUrl(state: ReviewState, action: UpdateAudioUrlAction): ReviewState {
  return updateQuiz(state, action.quizId, (q) => ({
    ...q,
    quiz: {
      ...q.quiz,
      termAudio: action.audioBase64,
    },
  }));
}

function handleNextQuiz(state: ReviewState): ReviewState {
  const nextIndex = Math.min(state.currentQuizIndex + 1, state.quizzes.length - 1);
  return {
    ...state,
    currentQuizIndex: nextIndex,
  };
}

function handleFlagCurrentCard(state: ReviewState): ReviewState {
  const currentQuiz = state.quizzes[state.currentQuizIndex];
  if (!currentQuiz) return state;

  const filteredQuizzes = state.quizzes.filter(
    (q) => q.quiz.cardId !== currentQuiz.quiz.cardId
  );

  return {
    ...state,
    quizzes: filteredQuizzes,
    currentQuizIndex: Math.min(state.currentQuizIndex, filteredQuizzes.length - 1),
  };
}

export function reviewReducer(state: ReviewState, action: Action): ReviewState {
  switch (action.type) {
    case "LOAD_QUIZZES":
      return handleLoadQuizzes(state, action);
    case "SET_GRADE":
      return handleSetGrade(state, action);
    case "SERVER_FEEDBACK":
      return handleServerFeedback(state, action);
    case "UPDATE_AUDIO_URL":
      return handleUpdateAudioUrl(state, action);
    case "NEXT_QUIZ":
      return handleNextQuiz(state);
    case "FLAG_CURRENT_CARD":
      return handleFlagCurrentCard(state);
    default:
      return state;
  }
}
