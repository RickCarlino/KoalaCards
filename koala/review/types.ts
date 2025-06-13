import { z } from "zod";
import { QuizList as ZodQuizList } from "../types/zod"; // Renamed to avoid conflict

// Types from logic.ts
export type QuizList = z.infer<typeof ZodQuizList>["quizzes"];
export type ItemType = keyof Queue;
export type QueueItem = {
  cardUUID: string;
  itemType: ItemType;
  stepUuid: string;
};

type QueueType =
  | "feedback"
  | "listening"
  | "newWordIntro"
  | "newWordOutro"
  | "pending"
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

export type State = {
  totalItems: number;
  itemsComplete: number;
  currentItem: QueueItem | undefined;
  queue: Queue;
  cards: QuizMap;
  recordings: Record<string, Recording>;
};

export type ReplaceCardAction = { type: "REPLACE_CARDS"; payload: Quiz[] };
export type SkipCardAction = { type: "SKIP_CARD"; payload: UUID };
export type RecordingCapturedAction = {
  type: "RECORDING_CAPTURED";
  payload: { uuid: string; audio: string };
};
export type ClearRecordingAction = {
  type: "CLEAR_RECORDING";
  payload: { uuid: string };
};
export type CompleteItemAction = {
  type: "COMPLETE_ITEM";
  payload: { uuid: string };
};
export type GiveUpAction = {
  type: "GIVE_UP";
  payload: { cardUUID: string };
};

export type Action =
  | ReplaceCardAction
  | SkipCardAction
  | RecordingCapturedAction
  | ClearRecordingAction
  | CompleteItemAction
  | GiveUpAction;
export const EVERY_QUEUE_TYPE: (keyof Queue)[] = [
  "feedback",
  "newWordIntro",
  "remedialIntro",
  "listening",
  "speaking",
  "newWordOutro",
  "remedialOutro",
  "pending",
];

export type CardReviewProps = {
  onProceed: () => void;
  onSkip: (uuid: string) => void;
  onGiveUp: (cardUUID: string) => void;
  itemsComplete: number;
  totalItems: number;
  itemType: ItemType;
  card: Quiz;
  recordings: Record<string, Recording>;
  currentStepUuid: string;
};
export type CardUI = React.FC<CardReviewProps>;
