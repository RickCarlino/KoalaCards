import { prismaClient } from "@/koala/prisma-client";
import { Quiz, Card } from "@prisma/client";
import { unique } from "radash";
import { getUserSettings } from "./auth-helpers";
import { autoPromoteCards } from "./autopromote";
import { errorReport } from "./error-report";
import { maybeGetCardImageUrl } from "./image";
import { LessonType } from "./shared-types";
import { generateLessonAudio } from "./speech";

type GetLessonInputParams = {
  userId: string;
  deckId: number;
  now: number;
  take: number;
};

type LocalQuiz = Quiz & { Card: Card };

function interleave<T>(max: number, ...lists: T[][]): T[] {
  const result: T[] = [];
  let index = 0;
  while (result.length < max) {
    let inserted = false;
    for (const list of lists) {
      if (index < list.length) {
        result.push(list[index]);
        inserted = true;
        if (result.length === max) return result;
      }
    }
    if (!inserted) break;
    index++;
  }
  return result;
}

async function buildQuizPayload(quiz: LocalQuiz, playbackPercentage: number) {
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
      speed: 115,
    }),
    termAudio: await generateLessonAudio({
      card: quiz.Card,
      lessonType: "listening",
      speed: r > 1 ? playbackPercentage : 95,
    }),
    langCode: quiz.Card.langCode,
    lastReview: quiz.lastReview || 0,
    imageURL: await maybeGetCardImageUrl(quiz.Card.imageBlobId),
    stability: quiz.stability,
    difficulty: quiz.difficulty,
  };
}

async function getAudioSpeed(userId: string) {
  const s = await getUserSettings(userId);
  return s.playbackSpeed || 1.0;
}

async function getCardsAllowedPerDay(userId: string) {
  const s = await getUserSettings(userId);
  return s.cardsPerDayMax || 24;
}

async function newCardsLearnedToday(userId: string) {
  const t = Date.now() - 24 * 60 * 60 * 1000;
  return prismaClient.card.count({
    where: {
      userId,
      Quiz: { some: { firstReview: { gte: t } } },
    },
  });
}

async function fetchDueCards(
  userId: string,
  deckId: number,
  now: number,
  quizType: string,
  older: boolean,
  limit: number,
) {
  if (limit < 1) return [];
  return prismaClient.quiz.findMany({
    where: {
      Card: { userId, deckId, flagged: { not: true } },
      quizType,
      nextReview: { lt: now },
      lastReview: { gt: 0 },
    },
    include: { Card: true },
    orderBy: { Card: { createdAt: older ? "asc" : "desc" } },
    take: limit,
  });
}

async function fetchNewCards(
  userId: string,
  deckId: number,
  older: boolean,
  limit: number,
) {
  if (limit < 1) return [];
  return prismaClient.quiz.findMany({
    where: {
      Card: { userId, deckId, flagged: { not: true } },
      lastReview: { equals: 0 },
    },
    include: { Card: true },
    orderBy: { Card: { createdAt: older ? "asc" : "desc" } },
    take: limit,
  });
}

export async function getLessons(p: GetLessonInputParams) {
  const { userId, deckId, now, take } = p;
  await autoPromoteCards(userId);
  if (take > 45) return errorReport("Too many cards requested.");
  const speedPercent = Math.round((await getAudioSpeed(userId)) * 100);
  const dailyCap = await getCardsAllowedPerDay(userId);
  const learnedToday = await newCardsLearnedToday(userId);
  const canLearn = Math.max(dailyCap - learnedToday, 0);
  const takeNew = Math.min(take, canLearn);
  const listeningDueOld = await fetchDueCards(
    userId,
    deckId,
    now,
    "listening",
    true,
    take,
  );
  const listeningDueNew = await fetchDueCards(
    userId,
    deckId,
    now,
    "listening",
    false,
    take,
  );
  const speakingDueOld = await fetchDueCards(
    userId,
    deckId,
    now,
    "speaking",
    true,
    take,
  );
  const speakingDueNew = await fetchDueCards(
    userId,
    deckId,
    now,
    "speaking",
    false,
    take,
  );
  const importedEarly = await fetchNewCards(userId, deckId, true, takeNew);
  const importedLate = await fetchNewCards(userId, deckId, false, takeNew);
  const combined = interleave(
    take * 6,
    importedEarly,
    importedLate,
    listeningDueOld,
    listeningDueNew,
    speakingDueOld,
    speakingDueNew,
  );
  const uniqueByCardId = unique(combined, (q) => q.cardId);
  const uniqueByQuizId = unique(uniqueByCardId, (q) => q.id);
  return uniqueByQuizId.slice(0, take).map((quiz) => {
    const needsDictation =
      quiz.quizType === "listening" && (quiz.repetitions || 0) < 1;
    const quizType = needsDictation ? "dictation" : quiz.quizType;
    return buildQuizPayload({ ...quiz, quizType }, speedPercent);
  });
}
