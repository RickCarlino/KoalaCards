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
  audio: string;
  translationAudioUrl: string;
  imageURL?: string | undefined;
};

export interface Props {
  quizzes: Quiz[];
  totalCards: number;
  quizzesDue: number;
  newCards: number;
}

export interface QuizProps {
  quiz: Quiz;
  onComplete: (grade: Grade) => void;
}

export type QuizComp = React.FC<QuizProps>;

interface Card {
  cardId: number;
}

// Define the status for each quiz
type QuizStatus =
  | "pending"
  | "completed"
  | "failed"
  | "awaitingGrading"
  | "graded";

// Define the state for each quiz in the session
export interface QuizState {
  quiz: Quiz;
  response?: any; // User's response (text, audio, etc.)
  grade?: Grade;
  status: QuizStatus;
  serverGradingResult?: "correct" | "incorrect" | "error";
  serverResponse?: any; // Response from the server (e.g., transcription)
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
  | { type: "SET_GRADE"; grade: Grade }
  | { type: "GIVE_UP" }
  | { type: "FLAG_CARD" }
  | { type: "ADD_NOTE"; note: string }
  | { type: "EDIT_CARD"; cardId: number; updates: Partial<Card> }
  | { type: "EXIT_EARLY" }
  | {
      type: "RECEIVE_GRADING_RESULT";
      quizId: number;
      result: "correct" | "incorrect" | "error";
      serverResponse: string;
    }
  | { type: "FINALIZE_REVIEW" }
  | { type: "NEXT_QUIZ" }
  | { type: "PREVIOUS_QUIZ" }
  | { type: "UPDATE_DIFFICULTY"; quizId: number; grade: Grade };
