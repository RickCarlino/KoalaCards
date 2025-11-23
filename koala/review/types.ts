import { z } from "zod";
import { QuizList as ZodQuizList } from "../types/zod";

type QuizList = z.infer<typeof ZodQuizList>["quizzes"];
export type ItemType = keyof Queue;
export type QueueItem = {
  cardUUID: string;
  itemType: ItemType;
  stepUuid: string;
};

type QueueType =
  | "newWordIntro"
  | "newWordOutro"
  | "remedialIntro"
  | "remedialOutro"
  | "speaking";

export type QuizMap = Record<string, Quiz>;
export type Queue = Record<QueueType, QueueItem[]>;
type UUID = { uuid: string };

export type Quiz = QuizList[number] & UUID;

export type GradingResult = {
  transcription: string;
  isCorrect: boolean;
  feedback: string;
  quizResultId: number | null;
};

export type State = {
  currentItem: QueueItem | undefined;
  queue: Queue;
  cards: QuizMap;
  gradingResults: Record<string, GradingResult>;
  initialCardCount: number;
  completedCards: Set<string>;
};

export type ReplaceCardAction = { type: "REPLACE_CARDS"; payload: Quiz[] };
export type SkipCardAction = { type: "SKIP_CARD"; payload: UUID };
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
  | CompleteItemAction
  | GiveUpAction
  | GradingResultCapturedAction;
export const EVERY_QUEUE_TYPE: (keyof Queue)[] = [
  "newWordIntro",
  "remedialIntro",
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
  currentStepUuid: string;
  onGradingResultCaptured: (
    cardUUID: string,
    result: GradingResult,
  ) => void;
  onProvideAudioHandler?: (handler: (blob: Blob) => Promise<void>) => void;
};
export type CardUI = React.FC<CardReviewProps>;
