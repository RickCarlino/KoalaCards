import { createDeck, Grade } from "femto-fsrs";
import type { Card } from "@prisma/client";

const FSRS = createDeck({ requestedRetentionRate: 0.7 });

const DAYS = 24 * 60 * 60 * 1000;

type PartialCardKeys =
  | "difficulty"
  | "stability"
  | "lastReview"
  | "lapses"
  | "repetitions";

type PartialCard = Pick<Card, PartialCardKeys>;

type SchedulingData = {
  difficulty: number;
  stability: number;
  nextReview: number;
};

function fuzzNumber(num: number) {
  const pct = num * 0.3;
  const fuzzFactor = (Math.random() * 2 - 1) * pct;

  return num + fuzzFactor;
}

function scheduleNewCard(grade: Grade, now = Date.now()): SchedulingData {
  const x = FSRS.newCard(grade);

  return {
    difficulty: x.D,
    stability: x.S,
    nextReview: now + fuzzNumber(x.I * DAYS),
  };
}

export function calculateSchedulingData(
  quiz: PartialCard,
  grade: Grade,
  now = Date.now(),
): SchedulingData {
  if (quiz.lapses + quiz.repetitions === 0) {
    return scheduleNewCard(grade, now);
  }
  const fsrsCard = {
    D: quiz.difficulty,
    S: quiz.stability,
  };
  const past = (now - quiz.lastReview) / DAYS;
  const result = FSRS.gradeCard(fsrsCard, past, grade);
  return {
    difficulty: result.D,
    stability: result.S,
    nextReview: now + fuzzNumber(result.I * DAYS),
  };
}

export function getGradeButtonText(quiz: PartialCard): [Grade, string][] {
  const now = Date.now();
  const SCALE: Record<Grade, string> = {
    [Grade.AGAIN]: "😵",
    [Grade.HARD]: "😐",
    [Grade.GOOD]: "😊",
    [Grade.EASY]: "😎",
  };
  return [Grade.AGAIN, Grade.HARD, Grade.GOOD, Grade.EASY].map((grade) => {
    const emoji = SCALE[grade];
    const { nextReview } = calculateSchedulingData(quiz, grade, now);
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
