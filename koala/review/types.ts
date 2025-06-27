import { z } from "zod";
import { QuizList as ZodQuizList } from "../types/zod"; // Renamed to avoid conflict

// Types from logic.ts
type QuizList = z.infer<typeof ZodQuizList>["quizzes"];
export type ItemType = keyof Queue;
export type QueueItem = {
  cardUUID: string;
  itemType: ItemType;
  stepUuid: string;
};

type QueueType =
  | "listening"
  | "newWordIntro"
  | "newWordOutro"
  | "remedialIntro"
  | "remedialOutro"
  | "speaking";

export type QuizMap = Record<string, Quiz>;
export type Queue = Record<QueueType, QueueItem[]>;
type UUID = { uuid: string };

export type Quiz = QuizList[number] & UUID;

export type Recording = {
  stepUuid: string;
  audio: string;
};

export type GradingResult = {
  transcription: string;
  isCorrect: boolean;
  feedback: string;
};

export type State = {
  currentItem: QueueItem | undefined;
  queue: Queue;
  cards: QuizMap;
  recordings: Record<string, Recording>;
  gradingResults: Record<string, GradingResult>;
  initialCardCount: number;
  completedCards: Set<string>;
};

export type ReplaceCardAction = { type: "REPLACE_CARDS"; payload: Quiz[] };
export type SkipCardAction = { type: "SKIP_CARD"; payload: UUID };
type RecordingCapturedAction = {
  type: "RECORDING_CAPTURED";
  payload: { uuid: string; audio: string };
};
type ClearRecordingAction = {
  type: "CLEAR_RECORDING";
  payload: { uuid: string };
};
type CompleteItemAction = {
  type: "COMPLETE_ITEM";
  payload: { uuid: string };
};
type GiveUpAction = {
  type: "GIVE_UP";
  payload: { cardUUID: string };
};
type GradingResultCapturedAction = {
  type: "STORE_GRADE_RESULT";
  payload: { cardUUID: string; result: GradingResult };
};

export type Action =
  | ReplaceCardAction
  | SkipCardAction
  | RecordingCapturedAction
  | ClearRecordingAction
  | CompleteItemAction
  | GiveUpAction
  | GradingResultCapturedAction;
export const EVERY_QUEUE_TYPE: (keyof Queue)[] = [
  "newWordIntro",
  "remedialIntro",
  "listening",
  "speaking",
  "newWordOutro",
  "remedialOutro",
];

export type CardReviewProps = {
  onProceed: () => void;
  onSkip: (uuid: string) => void;
  onGiveUp: (cardUUID: string) => void;
  itemType: ItemType;
  card: Quiz;
  recordings: Record<string, Recording>;
  currentStepUuid: string;
  onGradingResultCaptured: (
    cardUUID: string,
    result: GradingResult,
  ) => void;
  repairCard: (cardId: number, stepUuid: string) => Promise<void>;
};
export type CardUI = React.FC<CardReviewProps>;
