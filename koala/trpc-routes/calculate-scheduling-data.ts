import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type CardInput,
  type Grade,
} from "ts-fsrs";
import type { Card } from "@prisma/client";
import { resolveRequestedRetention } from "@/koala/settings/requested-retention";

const fsrsCache = new Map<number, ReturnType<typeof fsrs>>();

function getFsrs(requestedRetention?: number) {
  const normalizedRetention =
    resolveRequestedRetention(requestedRetention);
  const cached = fsrsCache.get(normalizedRetention);
  if (cached) {
    return cached;
  }
  const instance = fsrs(
    generatorParameters({
      request_retention: normalizedRetention,
      enable_fuzz: true,
      enable_short_term: false,
    }),
  );
  fsrsCache.set(normalizedRetention, instance);
  return instance;
}

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

const gradeOrder: Grade[] = [
  Rating.Again,
  Rating.Hard,
  Rating.Good,
  Rating.Easy,
];

function isNewCard(quiz: PartialCard) {
  return quiz.lapses + quiz.repetitions === 0;
}

function toFsrsCardInput(quiz: PartialCard, now: number): CardInput {
  const lastReview = quiz.lastReview || 0;
  const nextReview = quiz.nextReview || 0;
  const lapses = Math.max(0, Math.floor(quiz.lapses || 0));
  const repetitions = Math.max(0, Math.floor(quiz.repetitions || 0));
  const hasHistory = repetitions + lapses > 0 && lastReview > 0;
  const elapsedDays = lastReview
    ? Math.max(0, (now - lastReview) / DAYS)
    : 0;
  const scheduledDays =
    lastReview && nextReview
      ? Math.max(0, (nextReview - lastReview) / DAYS)
      : 0;

  return {
    due: nextReview || now,
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

function scheduleNewCard(
  grade: Grade,
  now = Date.now(),
  requestedRetention?: number,
): SchedulingData {
  const nowDate = new Date(now);
  const card = createEmptyCard(nowDate);
  const result = getFsrs(requestedRetention).next(card, nowDate, grade);

  return toSchedulingData(result.card);
}

export function calculateSchedulingData(
  quiz: PartialCard,
  grade: Grade,
  now = Date.now(),
  requestedRetention?: number,
): SchedulingData {
  if (isNewCard(quiz)) {
    return scheduleNewCard(grade, now, requestedRetention);
  }
  const nowDate = new Date(now);
  const fsrsCard = toFsrsCardInput(quiz, now);
  const result = getFsrs(requestedRetention).next(
    fsrsCard,
    nowDate,
    grade,
  );

  return toSchedulingData(result.card);
}

export function getGradeButtonText(
  quiz: PartialCard,
  requestedRetention?: number,
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
      requestedRetention,
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
