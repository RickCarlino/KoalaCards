import { Grade } from "femto-fsrs";
import { prismaClient } from "../prisma-client";
import { Card } from "@prisma/client";
import { calculateSchedulingData } from "./calculate-scheduling-data";

type CardGradingFields =
  | "difficulty"
  | "firstReview"
  | "id"
  | "lapses"
  | "lastReview"
  | "repetitions"
  | "stability";

type GradedCard = Pick<Card, CardGradingFields>;

export async function setGrade(
  card: GradedCard,
  grade: Grade,
  now = Date.now(),
) {
  const isFail = grade === Grade.AGAIN;
  const data = {
    ...card,
    ...calculateSchedulingData(card, grade, now),
    repetitions: (card.repetitions || 0) + 1,
    lastReview: now,
    firstReview: card.firstReview || now,
    lastFailure: isFail ? now : 0,
    lapses: (card.lapses || 0) + (isFail ? 1 : 0),
  };

  await prismaClient.card.update({
    where: { id: card.id },
    data: {
      ...(grade === Grade.AGAIN ? { lastFailure: now } : {}),
      difficulty: data.difficulty,
      lapses: data.lapses,
      repetitions: data.repetitions,
      stability: data.stability,
      firstReview: data.firstReview,
      lastReview: data.lastReview,
      nextReview: data.nextReview,
    },
  });
}
