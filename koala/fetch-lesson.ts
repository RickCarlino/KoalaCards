import { prismaClient } from "@/koala/prisma-client";
import { Card, Quiz } from "@prisma/client";
import { map, unique } from "radash";
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

type GetCardsProps = {
  userId: string;
  deckId: number;
  now: number;
  take: number;
  isReview: boolean;
};

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

async function fetchQuizCards(props: GetCardsProps) {
  const { userId, now, take, isReview, deckId } = props;
  if (take < 1) return [];
  const base = { Card: { userId, deckId, flagged: { not: true } } };
  const filters = isReview
    ? { ...base, nextReview: { lt: now }, repetitions: { gt: 0 } }
    : { ...base, repetitions: 0 };
  const query = { where: filters, include: { Card: true }, take };
  const sort = (dir: "asc" | "desc") =>
    isReview ? [{ nextReview: dir }] : [{ Card: { createdAt: dir } }];
  const ascList = await prismaClient.quiz.findMany({
    ...query,
    orderBy: sort("asc"),
  });
  const descList = await prismaClient.quiz.findMany({
    ...query,
    orderBy: sort("desc"),
  });
  const combined = interleave(take * 2, ascList, descList);
  return unique(combined, (x) => x.id).slice(0, take);
}

function newCardsLearnedToday(userId: string): Promise<number> {
  const timeLimit = Date.now() - 24 * 60 * 60 * 1000;
  return prismaClient.card.count({
    where: {
      userId,
      Quiz: {
        // "Some" or "Every" ? Hmm...
        some: {
          firstReview: { gte: timeLimit },
        },
      },
    },
  });
}

type LocalQuiz = Quiz & { Card: Card };

async function buildQuizPayload(quiz: LocalQuiz, playbackPercentage: number) {
  const repetitions = quiz.repetitions || 0;
  return {
    quizId: quiz.id,
    cardId: quiz.cardId,
    definition: quiz.Card.definition,
    term: quiz.Card.term,
    repetitions,
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
      speed: repetitions > 2 ? playbackPercentage : 95,
    }),
    langCode: quiz.Card.langCode,
    lastReview: quiz.lastReview || 0,
    imageURL: await maybeGetCardImageUrl(quiz.Card.imageBlobId),
    stability: quiz.stability,
    difficulty: quiz.difficulty,
  };
}

async function getAudioSpeed(userId: string) {
  const settings = await getUserSettings(userId);
  return settings.playbackSpeed || 1.00;
}

async function getCardsAllowedPerDay(userId: string) {
  const settings = await getUserSettings(userId);
  return settings.cardsPerDayMax || 24;
}

async function fetchNewCards(props: Omit<GetCardsProps, "isReview">) {
  const { userId, now, take, deckId } = props;
  const maxNew = await getCardsAllowedPerDay(userId);
  const newToday = await newCardsLearnedToday(userId);
  const allowed = Math.max(maxNew - newToday, 0);
  const limit = Math.min(take, allowed);
  return fetchQuizCards({ userId, deckId, now, take: limit, isReview: false });
}

export async function getLessons(p: GetLessonInputParams) {
  const { userId, now, take, deckId } = p;
  await autoPromoteCards(userId);
  if (take > 45) return errorReport("Too many cards requested.");
  const reviewCards = await fetchQuizCards({
    userId,
    deckId,
    now,
    take,
    isReview: true,
  });
  const freshCards = await fetchNewCards({ userId, deckId, now, take });
  const blended = interleave(take * 2, reviewCards, freshCards);
  const uniqueCards = unique(blended, (x) => x.cardId).slice(0, take);
  const speed = Math.round((await getAudioSpeed(userId)) * 100);
  return map(uniqueCards, (quiz) => {
    const needsDictation =
      quiz.quizType === "listening" && quiz.repetitions < 1;
    const quizType = needsDictation ? "dictation" : quiz.quizType;
    return buildQuizPayload({ ...quiz, quizType }, speed);
  });
}
