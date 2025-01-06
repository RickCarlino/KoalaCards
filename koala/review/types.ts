import { Grade } from "femto-fsrs";

// Define the types
export type Quiz = {
  cardId: number;
  definition: string;
  definitionAudio: string;
  imageURL?: string | undefined;
  langCode: string;
  lessonType: "listening" | "speaking" | "dictation";
  quizId: number;
  term: string;
  termAudio: string;
  lapses: number;
  repetitions: number;
  difficulty: number;
  stability: number;
  lastReview: number;
};

export interface Props {
  quizzes: Quiz[];
  quizzesDue: number;
  onSave(): Promise<void>;
}
export type OnCompleteProps = {
  status: QuizStatus;
  feedback: string;
  userResponse: string;
};

export interface QuizProps {
  quiz: QuizState;
  // Called when user sets grade.
  onGraded: (grade: Grade) => void;
  // Called when all async tasks / grading are done.
  // Quiz will be stuck in "awaitingGrading" until this is called.
  onComplete: (p: OnCompleteProps) => void;
}

export type QuizComp = React.FC<QuizProps>;

// Define the status for each quiz
type QuizStatus = "pass" | "fail" | "error";

// Define the state for each quiz in the session
export interface QuizState {
  quiz: Quiz;
  response?: string; // User's response (text, audio, etc.)
  grade?: Grade;
  serverGradingResult?: QuizStatus;
  serverResponse?: string; // Response from the server
}

// Define the overall state for the review session
export interface ReviewState {
  quizzes: QuizState[];
  currentQuizIndex: number;
}

// Define the possible actions
export type LoadQuizzesAction = { type: "LOAD_QUIZZES"; quizzes: Quiz[] };
export type SetGradeAction = {
  type: "SET_GRADE";
  grade: Grade;
  quizId: number;
};
export type PauseCurrentCardAction = { type: "PAUSE_CURRENT_CARD" };
export type ServerFeedbackAction = {
  type: "SERVER_FEEDBACK";
  quizId: number;
  result: QuizStatus;
  serverResponse: string;
  userResponse: string;
};
export type NextQuizAction = { type: "NEXT_QUIZ" };
export type UpdateAudioUrlAction = {
  type: "UPDATE_AUDIO_URL";
  quizId: number;
  audioBase64: string;
};

export type Action =
  | LoadQuizzesAction
  | SetGradeAction
  | PauseCurrentCardAction
  | ServerFeedbackAction
  | NextQuizAction
  | UpdateAudioUrlAction;
