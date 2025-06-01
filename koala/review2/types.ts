import { z } from "zod";
import { QuizList as ZodQuizList } from "../types/zod"; // Renamed to avoid conflict

// Types from logic.ts
export type QuizList = z.infer<typeof ZodQuizList>["quizzes"];
export type ItemType = keyof Queue;
export type QueueItem = { cardUUID: string; itemType: ItemType };

export type QueueType =
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
export type UUID = { uuid: string };

export type Quiz = QuizList[number] & UUID;

export type State = {
  totalItems: number;
  itemsComplete: number;
  queue: Queue;
  cards: QuizMap;
};

export type ReplaceCardAction = { type: "REPLACE_CARDS"; payload: Quiz[] };
export type SkipCardAction = { type: "SKIP_CARD"; payload: UUID };
export type Action = ReplaceCardAction | SkipCardAction;
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
  itemsComplete: number;
  totalItems: number;
  itemType: ItemType;
  card: Quiz;
};
export type CardUI = React.FC<CardReviewProps>;
