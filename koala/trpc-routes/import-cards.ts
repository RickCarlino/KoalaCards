import { Rating, type Grade } from "ts-fsrs";
import { prismaClient } from "../prisma-client";
import { Card } from "@prisma/client";
import { timeUntil } from "@/koala/time-until";
import { calculateSchedulingData } from "./calculate-scheduling-data";

type CardGradingFields =
  | "difficulty"
  | "firstReview"
  | "id"
  | "lapses"
  | "lastReview"
  | "nextReview"
  | "repetitions"
  | "stability";

type GradedCard = Pick<Card, CardGradingFields>;

const shouldPauseForLapses = (
  maxLapses: number | undefined,
  lapses: number,
) => {
  if (!maxLapses || maxLapses <= 0) {
    return false;
  }
  return lapses >= maxLapses;
};

export async function setGrade(
  card: GradedCard,
  grade: Grade,
  now = Date.now(),
  requestedRetention?: number,
  maxLapses?: number,
) {
  const isFail = grade === Rating.Again;
  const nextLapses = (card.lapses || 0) + (isFail ? 1 : 0);
  const pauseForLapses = shouldPauseForLapses(maxLapses, nextLapses);
  const data = {
    ...card,
    ...calculateSchedulingData(card, grade, now, requestedRetention),
    repetitions: (card.repetitions || 0) + 1,
    lastReview: now,
    firstReview: card.firstReview || now,
    lastFailure: isFail ? now : 0,
    lapses: nextLapses,
  };

  const { id, nextReview } = await prismaClient.card.update({
    where: { id: card.id },
    data: {
      ...(grade === Rating.Again ? { lastFailure: now } : {}),
      difficulty: data.difficulty,
      lapses: data.lapses,
      repetitions: data.repetitions,
      stability: data.stability,
      firstReview: data.firstReview,
      lastReview: data.lastReview,
      nextReview: data.nextReview,
      ...(pauseForLapses ? { paused: true } : {}),
    },
  });
  console.log(`Card ${id} next review: ${timeUntil(nextReview)}`);
}
