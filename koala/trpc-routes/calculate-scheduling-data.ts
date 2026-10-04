import {
  createEmptyCard,
  Rating,
  State,
  type Card as FsrsCard,
  type CardInput,
  type Grade,
  type RecordLogItem,
} from "ts-fsrs";
import type { Card } from "@/koala/generated/prisma/client";
import {
  buildDefaultFsrsParameters,
  deserializeDeckScheduler,
  getFsrsInstance,
  type ResolvedDeckScheduler,
  type SerializedDeckScheduler,
} from "../fsrs/scheduler.ts";

const DAYS = 24 * 60 * 60 * 1000;

type PartialCard = Pick<
  Card,
  "difficulty" | "stability" | "lastReview" | "lapses" | "repetitions"
> & {
  nextReview?: number;
};

type SchedulingData = {
  difficulty: number;
  stability: number;
  nextReview: number;
};

export type SchedulingReviewResult = SchedulingData & {
  fsrsCardBefore: CardInput | FsrsCard;
  fsrsCardAfter: FsrsCard;
  rawLog: RecordLogItem["log"];
  dueAt: Date;
  scheduledDays: number;
  elapsedDays: number;
  stabilityBefore: number;
  stabilityAfter: number;
  difficultyBefore: number;
  difficultyAfter: number;
};

type SchedulingContext =
  number | ResolvedDeckScheduler | SerializedDeckScheduler | undefined;

const gradeOrder: Grade[] = [
  Rating.Again,
  Rating.Hard,
  Rating.Good,
  Rating.Easy,
];

function isNewCard(quiz: PartialCard) {
  return quiz.lapses + quiz.repetitions === 0;
}

function normalizeReviewCount(value: number | undefined): number {
  return Math.max(0, Math.floor(value || 0));
}

function resolveElapsedDays(lastReview: number, now: number): number {
  if (!lastReview) {
    return 0;
  }
  return Math.max(0, (now - lastReview) / DAYS);
}

function resolveScheduledDays(
  lastReview: number,
  nextReview: number | undefined,
): number {
  if (!lastReview || !nextReview) {
    return 0;
  }
  return Math.max(0, (nextReview - lastReview) / DAYS);
}

function hasReviewHistory(
  repetitions: number,
  lapses: number,
  lastReview: number,
): boolean {
  return repetitions + lapses > 0 && lastReview > 0;
}

export function toFsrsCardInput(
  quiz: PartialCard,
  now: number,
): CardInput {
  const lastReview = quiz.lastReview || 0;
  const lapses = normalizeReviewCount(quiz.lapses);
  const repetitions = normalizeReviewCount(quiz.repetitions);
  const hasHistory = hasReviewHistory(repetitions, lapses, lastReview);
  const elapsedDays = resolveElapsedDays(lastReview, now);
  const scheduledDays = resolveScheduledDays(lastReview, quiz.nextReview);

  return {
    due: quiz.nextReview || now,
    stability: quiz.stability,
    difficulty: quiz.difficulty,
    elapsed_days: elapsedDays,
    scheduled_days: scheduledDays,
    reps: repetitions,
    lapses,
    state: hasHistory ? State.Review : State.New,
    last_review: lastReview || now,
    learning_steps: 0,
  };
}

function toSchedulingData(card: FsrsCard): SchedulingData {
  return {
    difficulty: card.difficulty,
    stability: card.stability,
    nextReview: card.due.getTime(),
  };
}

function getSchedulingInstance(context: SchedulingContext) {
  if (typeof context === "object" && context && "cacheKey" in context) {
    const scheduler = isSerializedDeckScheduler(context)
      ? deserializeDeckScheduler(context)
      : context;
    return getFsrsInstance(scheduler);
  }

  const parameters = buildDefaultFsrsParameters(context);
  return getFsrsInstance({
    cacheKey: `legacy:${parameters.request_retention}`,
    parameters,
  });
}

function isSerializedDeckScheduler(
  context: ResolvedDeckScheduler | SerializedDeckScheduler,
): context is SerializedDeckScheduler {
  return typeof context.updatedAt === "string";
}

function scheduleNewCard(
  grade: Grade,
  now = Date.now(),
  context?: SchedulingContext,
): SchedulingReviewResult {
  const nowDate = new Date(now);
  const card = createEmptyCard(nowDate);
  const result = getSchedulingInstance(context).next(card, nowDate, grade);

  return toSchedulingReviewResult(card, result);
}

export function calculateSchedulingData(
  quiz: PartialCard,
  grade: Grade,
  now = Date.now(),
  context?: SchedulingContext,
): SchedulingData {
  return calculateSchedulingReview(quiz, grade, now, context);
}

export function calculateSchedulingReview(
  quiz: PartialCard,
  grade: Grade,
  now = Date.now(),
  context?: SchedulingContext,
): SchedulingReviewResult {
  if (isNewCard(quiz)) {
    return scheduleNewCard(grade, now, context);
  }
  const nowDate = new Date(now);
  const fsrsCard = toFsrsCardInput(quiz, now);
  const result = getSchedulingInstance(context).next(
    fsrsCard,
    nowDate,
    grade,
  );

  return toSchedulingReviewResult(fsrsCard, result);
}

export function getGradeButtonText(
  quiz: PartialCard,
  context?: SchedulingContext,
): [Grade, string][] {
  const now = Date.now();
  const SCALE: Record<Grade, string> = {
    [Rating.Again]: "😵",
    [Rating.Hard]: "😐",
    [Rating.Good]: "😊",
    [Rating.Easy]: "😎",
  };
  return gradeOrder.map((grade) => {
    const emoji = SCALE[grade];
    const { nextReview } = calculateSchedulingData(
      quiz,
      grade,
      now,
      context,
    );
    if (!nextReview) {
      return [grade, "❓SOON"];
    }
    const diff = nextReview - now;
    const minutes = Math.floor(diff / (60 * 1000));
    if (minutes < 5) {
      return [grade, emoji + " Very Soon"];
    }
    if (minutes < 60) {
      const val = Math.floor(minutes);
      return [grade, `${emoji}${val} minute${val === 1 ? "" : "s"}`];
    }

    if (minutes < 24 * 60) {
      const val = Math.floor(minutes / 60);
      return [
        grade,
        `${emoji}${Math.floor(minutes / 60)} hour${val === 1 ? "" : "s"}`,
      ];
    }

    if (minutes < 30 * 24 * 60) {
      const val = Math.floor(minutes / (24 * 60));
      return [grade, `${emoji}${val} day${val === 1 ? "" : "s"}`];
    }

    const val = Math.floor(minutes / (30 * 24 * 60));
    return [grade, `${emoji}${val} month${val === 1 ? "" : "s"}`];
  });
}

function toSchedulingReviewResult(
  before: CardInput | FsrsCard,
  result: RecordLogItem,
): SchedulingReviewResult {
  const data = toSchedulingData(result.card);
  return {
    ...data,
    fsrsCardBefore: before,
    fsrsCardAfter: result.card,
    rawLog: result.log,
    dueAt: result.log.due,
    scheduledDays: result.log.scheduled_days,
    elapsedDays: result.log.elapsed_days,
    stabilityBefore: before.stability,
    stabilityAfter: result.card.stability,
    difficultyBefore: before.difficulty,
    difficultyAfter: result.card.difficulty,
  };
}
