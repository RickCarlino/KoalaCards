import { prismaClient } from "@/koala/prisma-client";
import { map, shuffle } from "radash";
import { Quiz, Card } from "@prisma/client";
import { getUserSettings } from "./auth-helpers";
import { errorReport } from "./error-report";
import { maybeGetCardImageUrl } from "./image";
import { LessonType } from "./shared-types";
import { generateLessonAudio } from "./speech";

type GetLessonInputParams = {
  userId: string;
  /** Current time */
  now: number;
  /** Max number of cards to return */
  take: number;
};

async function getCards(
  userId: string,
  now: number,
  take: number,
  isReview: boolean,
) {
  if (take < 1) return [];

  const base = {
    Card: { userId, flagged: { not: true } },
  };

  const whereClause = isReview
    ? { ...base, nextReview: { lt: now }, repetitions: { gt: 0 } }
    : { ...base, repetitions: 0 };

  return await prismaClient.quiz.findMany({
    where: whereClause,
    distinct: ["cardId"],
    orderBy: [{ quizType: "asc" }, { nextReview: "asc" }],
    include: { Card: true },
    take,
  });
}

// A prisma quiz with Card included
type LocalQuiz = Quiz & { Card: Card };

async function prepareQuizData(quiz: LocalQuiz, playbackPercentage: number) {
  return {
    quizId: quiz.id,
    cardId: quiz.cardId,
    definition: quiz.Card.definition,
    term: quiz.Card.term,
    repetitions: quiz.repetitions,
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
      speed: quiz.repetitions > 2 ? playbackPercentage : 95,
    }),
    langCode: quiz.Card.langCode,
    lastReview: quiz.lastReview || 0,
    imageURL: await maybeGetCardImageUrl(quiz.Card.imageBlobId),
  };
}

const playbackSpeed = async (userID: string) => {
  return await getUserSettings(userID).then((s) => s.playbackSpeed || 1.05);
};
export default async function getLessons(p: GetLessonInputParams) {
  if (p.take > 15) return errorReport("Too many cards requested.");

  const { userId, now, take } = p;

  const playbackPercentage = Math.round((await playbackSpeed(userId)) * 100);

  const oldCards = await getCards(p.userId, p.now, take, true);
  const newCards = await getCards(userId, now, take - oldCards.length, false);
  const combined = [...shuffle(oldCards), ...shuffle(newCards)].slice(0, take);

  return await map(combined, (q) => {
    const quiz = { ...q, quizType: q.repetitions ? q.quizType : "dictation" };
    return prepareQuizData(quiz, playbackPercentage);
  });
}
