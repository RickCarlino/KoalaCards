import { Grade } from "femto-fsrs";

// Define the types
export type Quiz = {
  langCode: string;
  term: string;
  definition: string;
  repetitions: number;
  lapses: number;
  lastReview: number;
  quizId: number;
  cardId: number;
  lessonType: "listening" | "speaking" | "dictation";
  definitionAudio: string;
  termAudio: string;
  imageURL?: string | undefined;
};

export interface Props {
  quizzes: Quiz[];
  // totalCards: number;
  // quizzesDue: number;
  // newCards: number;
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

interface Card {
  cardId: number;
}

// Define the status for each quiz
type QuizStatus = "pass" | "fail" | "error";

// Define the state for each quiz in the session
export interface QuizState {
  quiz: Quiz;
  response?: string; // User's response (text, audio, etc.)
  grade?: Grade;
  serverGradingResult?: QuizStatus;
  serverResponse?: string; // Response from the server
  flagged: boolean;
  notes: string[];
}

// Define the overall state for the review session
export interface ReviewState {
  quizzes: QuizState[];
  currentQuizIndex: number;
  sessionStatus: "inProgress" | "finalized" | "exitedEarly";
}

// Define the possible actions
export type Action =
  | { type: "LOAD_QUIZZES"; quizzes: Quiz[] }
  | { type: "SUBMIT_RESPONSE"; response: string }
  | { type: "SET_GRADE"; grade: Grade; quizId: number }
  | { type: "GIVE_UP" }
  | { type: "FLAG_CARD" }
  | { type: "ADD_NOTE"; note: string }
  | { type: "EDIT_CARD"; cardId: number; updates: Partial<Card> }
  | { type: "EXIT_EARLY" }
  | {
      type: "RECEIVE_GRADING_RESULT";
      quizId: number;
      result: QuizStatus;
      serverResponse: string;
    }
  | { type: "FINALIZE_REVIEW" }
  | { type: "NEXT_QUIZ" }
  | { type: "PREVIOUS_QUIZ" }
  | { type: "UPDATE_DIFFICULTY"; quizId: number; grade: Grade };
