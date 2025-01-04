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
  /** Current time */
  now: number;
  /** Max number of cards to return */
  take: number;
};

type GetCardsProps = {
  userId: string;
  deckId: number;
  now: number;
  take: number;
  isReview: boolean;
};

const NEW_CARDS_PER_SESSION_MIN = 3;

// Split an array like a deck of cards.
function split<T>(l: T[], r: T[]): T[] {
  const output: T[] = [];
  const len = Math.max(l.length, r.length);
  for (let i = 0; i < len; i++) {
    if (l[i]) output.push(l[i]);
    if (r[i]) output.push(r[i]);
  }
  return output;
}

async function getCards(props: GetCardsProps) {
  const { userId, now, take, isReview, deckId } = props;
  if (take < 1) return [];

  const base = {
    Card: { userId, deckId, flagged: { not: true } },
  };

  const whereClause = isReview
    ? { ...base, nextReview: { lt: now }, repetitions: { gt: 0 } }
    : { ...base, repetitions: 0 };
  const p = {
    where: whereClause,
    include: { Card: true },
    take,
  };
  const orderBy = (i: "asc" | "desc") =>
    isReview ? [{ nextReview: i }] : [{ Card: { createdAt: i } }];
  // Grab old ones first, then new ones.
  const list1 = await prismaClient.quiz.findMany({
    ...p,
    orderBy: orderBy("asc"),
  });
  const list2 = await prismaClient.quiz.findMany({
    ...p,
    orderBy: orderBy("desc"),
  });
  return unique(split(list1, list2), (x) => x.id).slice(0, take);
}

function cardCountNewToday(userID: string): Promise<number> {
  const _24HoursAgo = Date.now() - 24 * 60 * 60 * 1000;

  return prismaClient.card.count({
    where: {
      userId: userID,
      Quiz: {
        every: {
          firstReview: {
            gte: _24HoursAgo,
          },
        },
      },
    },
  });
}

// A prisma quiz with Card included
type LocalQuiz = Quiz & { Card: Card };

async function prepareQuizData(quiz: LocalQuiz, playbackPercentage: number) {
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
      // Always play new cards at 95% speed
      speed: repetitions > 2 ? playbackPercentage : 95,
    }),
    langCode: quiz.Card.langCode,
    lastReview: quiz.lastReview || 0,
    imageURL: await maybeGetCardImageUrl(quiz.Card.imageBlobId),
    stability: quiz.stability,
    difficulty: quiz.difficulty,
  };
}

const playbackSpeed = async (userID: string) => {
  return await getUserSettings(userID).then((s) => s.playbackSpeed || 1.05);
};

const newCardsPerDay = async (userID: string) => {
  return await getUserSettings(userID).then((s) => s.cardsPerDayMax || 10);
};

const getNewCards = async (props: Omit<GetCardsProps, "isReview">) => {
  const { userId, now, take, deckId } = props;
  const maxNew = await newCardsPerDay(userId);
  const newToday = await cardCountNewToday(userId);
  const allowedNew = Math.max(maxNew - newToday, 0);
  const maxNewCards = Math.min(take, allowedNew);

  return await getCards({
    userId,
    deckId,
    now,
    take: maxNewCards,
    isReview: false,
  });
};

export async function getLessons(p: GetLessonInputParams) {
  const { userId, now, take, deckId } = p;
  await autoPromoteCards(userId);
  if (take > 45) return errorReport("Too many cards requested.");
  const p2 = { userId, now, take, deckId };
  const oldCards = await getCards({ ...p2, isReview: true });
  const newCards = await getNewCards({
    ...p2,
    // Insert fewer cards when there are many old cards
    // always provide at least 3 new cards.
    take: Math.max(take - oldCards.length, NEW_CARDS_PER_SESSION_MIN),
  });
  const shuffled = split(oldCards, newCards);
  const combined = unique(shuffled, (x) => x.cardId).slice(0, take);
  const audioSpeed = Math.round((await playbackSpeed(userId)) * 100);

  return await map(combined, (q) => {
    const isDictation = q.quizType === "listening" && q.repetitions < 1;
    const quizType = isDictation ? "dictation" : q.quizType;
    const quiz = { ...q, quizType };
    return prepareQuizData(quiz, audioSpeed);
  });
}
