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
  // lapses: number;
  // lastReview: number;
  // repetitions: number;
  // termAudio: string;
};

export interface Props {
  quizzes: Quiz[];
  onSave(): Promise<void>;
}

export interface QuizProps {
  quiz: Quiz;
  // Called when user sets grade.
  onGraded: (grade: Grade) => void;
  // Called when all async tasks / grading are done.
  // Quiz will be stuck in "awaitingGrading" until this is called.
  onComplete: (status: QuizStatus, feedback: string) => void;
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
export type Action =
  | { type: "LOAD_QUIZZES"; quizzes: Quiz[] }
  | { type: "SET_GRADE"; grade: Grade; quizId: number }
  | { type: "FLAG_CURRENT_CARD" }
  | {
      type: "SERVER_FEEDBACK";
      quizId: number;
      result: QuizStatus;
      serverResponse: string;
    }
  | { type: "NEXT_QUIZ" };
