import { createDeck, Grade } from "femto-fsrs";
import { errorReport } from "../error-report";
import { Quiz } from "@prisma/client";

const FSRS = createDeck({
  requestedRetentionRate: 0.89,
});

const DAYS = 24 * 60 * 60 * 1000;

type PartialQuizKeys =
  | "difficulty"
  | "stability"
  | "lastReview"
  | "lapses"
  | "repetitions";

type PartialQuiz = Pick<Quiz, PartialQuizKeys>;

type SchedulingData = {
  difficulty: number;
  stability: number;
  nextReview: number;
};

function fuzzNumber(num: number) {
  let pct = num * 0.2;
  let fuzzFactor = (Math.random() * 2 - 1) * pct;

  return num + fuzzFactor;
}

function scheduleNewCard(grade: Grade, now = Date.now()): SchedulingData {
  const x = FSRS.newCard(grade);
  const MINUTE = 60000;
  const grades: Record<Grade, number> = {
    [Grade.AGAIN]: 1 * MINUTE,
    [Grade.HARD]: 4 * 60 * MINUTE,
    [Grade.GOOD]: 50 * 60 * MINUTE,
    [Grade.EASY]: 4 * DAYS,
  };
  const nextReview = now + fuzzNumber(grades[grade]);

  if (!nextReview || nextReview < now) {
    return errorReport(`Invalid new card grade: ${grade}`);
  }

  return {
    difficulty: x.D,
    stability: x.S,
    nextReview,
  };
}

export function calculateSchedulingData(
  quiz: PartialQuiz,
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

// Gives a human-readable representation of the next quiz due date.
// Uses the nearest time unit, all the way up to months.
export function getGradeButtonText(quiz: PartialQuiz): [Grade, string][] {
  const now = Date.now();
  return [Grade.AGAIN, Grade.HARD, Grade.GOOD, Grade.EASY].map((grade) => {
    const { nextReview } = calculateSchedulingData(quiz, grade, now);
    const diff = nextReview - now;
    const minutes = Math.floor(diff / (60 * 1000));
    // Use minutes, hours, days, months:
    if (minutes < 60) {
      const val = Math.floor(minutes);
      return [grade, `${val} minute${val === 1 ? "" : "s"}`];
    }

    if (minutes < 24 * 60) {
      const val = Math.floor(minutes / 60);
      return [grade, `${Math.floor(minutes / 60)} hour${val === 1 ? "" : "s"}`];
    }

    if (minutes < 30 * 24 * 60) {
      const val = Math.floor(minutes / (24 * 60));
      return [grade, `${val} day${val === 1 ? "" : "s"}`];
    }

    const val = Math.floor(minutes / (30 * 24 * 60));
    return [grade, `${val} month${val === 1 ? "" : "s"}`];
  });
}
