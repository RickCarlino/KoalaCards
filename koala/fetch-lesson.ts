import { prismaClient } from "@/koala/prisma-client";
import { shuffle } from "radash";
import { getUserSettings } from "./auth-helpers";
import { LessonType } from "./shared-types";
import { generateLessonAudio } from "./speech";
import { maybeGetCardImageUrl } from "./image";

type GetLessonInputParams = {
  userId: string;
  deckId: number;
  now: number;
  take: number;
};

interface LessonPayload {
  quizId: number;
  cardId: number;
  definition: string;
  term: string;
  repetitions: number;
  lapses: number;
  lessonType: LessonType;
  definitionAudio: string;
  termAudio: string;
  langCode: string;
  lastReview: number;
  imageURL?: string;
  stability: number;
  difficulty: number;
}

export async function getLessons({
  userId,
  deckId,
  now,
  take,
}: GetLessonInputParams): Promise<LessonPayload[]> {
  const { cardsPerDayMax = 0 } = await getUserSettings(userId);
  const reviewsPerDayMax = cardsPerDayMax * 3;
  const THRESHOLD_24H = now - 24 * 60 * 60 * 1_000;
  let newThis24h = await prismaClient.quiz
    .findMany({
      where: {
        Card: { userId, deckId, flagged: false },
        firstReview: { gte: THRESHOLD_24H },
      },
      distinct: ["cardId"],
    })
    .then((qs) => qs.length);
  let reviewsThis24h = await prismaClient.quiz.count({
    where: {
      Card: { userId, deckId, flagged: false },
      lastReview: { gte: THRESHOLD_24H },
    },
  });
  const [newQs, ongoingQs, remedialQs, upcomingQs] = await Promise.all([
    prismaClient.quiz
      .findMany({
        where: {
          Card: { userId, deckId, flagged: false },
          lastReview: 0,
        },
        include: { Card: true },
      })
      .then(shuffle),
    prismaClient.quiz
      .findMany({
        where: {
          Card: { userId, deckId, flagged: false },
          lastReview: { gt: 0 },
          nextReview: { lte: now },
        },
        include: { Card: true },
      })
      .then(shuffle),
    prismaClient.card
      .findMany({
        where: {
          userId,
          deckId,
          lastFailure: { gt: 0 },
          flagged: false,
        },
        include: { Quiz: true },
      })
      .then((cards) =>
        shuffle(
          cards
            .map((c) => {
              const q = c.Quiz.sort(
                (a, b) => b.lastReview - a.lastReview,
              )[0];
              return { ...q, quizType: "remedial" as LessonType, Card: c };
            })
            .filter(Boolean),
        ),
      ),
    prismaClient.quiz
      .findMany({
        where: {
          Card: { userId, deckId, flagged: false },
          repetitions: { gte: 2 },
          nextReview: { gt: now, lte: now + 7 * 24 * 60 * 60 * 1_000 },
        },
        include: { Card: true },
      })
      .then(shuffle),
  ]);
  const hand: typeof newQs = [];
  const queues = [newQs, ongoingQs, remedialQs];
  let idx = 0;
  while (hand.length < take && queues.some((q) => q.length > 0)) {
    const q = queues[idx % 3];
    idx++;
    if (!q.length) {
      continue;
    }
    const peek = q[0];
    const isNew = peek.lastReview === 0;
    if (isNew && newThis24h >= cardsPerDayMax) {
      continue;
    }
    if (reviewsThis24h >= reviewsPerDayMax) {
      break;
    }
    const val = q.shift();
    val && hand.push(val);
    if (isNew) {
      newThis24h++;
    }
    reviewsThis24h++;
  }
  while (hand.length < take && upcomingQs.length) {
    if (reviewsThis24h >= reviewsPerDayMax) {
      break;
    }
    const val2 = upcomingQs.shift();
    val2 && hand.push(val2);
    reviewsThis24h++;
  }
  const seen = new Set<number>();
  const deduped = shuffle(hand).filter((q) => {
    if (seen.has(q.cardId)) {
      return false;
    }
    seen.add(q.cardId);
    return true;
  });
  const speed = (await getUserSettings(userId)).playbackSpeed || 1;
  const speedPercent = Math.round(speed * 100);
  const payloads = await Promise.all(
    deduped.map(async (quiz) => {
      const r = quiz.repetitions || 0;
      return {
        quizId: quiz.id,
        cardId: quiz.cardId,
        definition: quiz.Card.definition,
        term: quiz.Card.term,
        repetitions: r,
        lapses: quiz.lapses,
        lessonType: quiz.quizType as LessonType,
        definitionAudio: await generateLessonAudio({
          card: quiz.Card,
          lessonType: "speaking",
          speed: 125,
        }),
        termAudio: await generateLessonAudio({
          card: quiz.Card,
          lessonType: "listening",
          speed: r > 1 ? speedPercent : 100,
        }),
        langCode: quiz.Card.langCode,
        lastReview: quiz.lastReview || 0,
        imageURL: await maybeGetCardImageUrl(quiz.Card.imageBlobId),
        stability: quiz.stability,
        difficulty: quiz.difficulty,
      };
    }),
  );
  return payloads;
}
