import { prismaClient } from "@/koala/prisma-client";
import { Card } from "@prisma/client";
import { autoPromoteCards } from "./autopromote";
import { errorReport } from "./error-report";
import { maybeGetCardImageUrl } from "./image";
import { generateLessonAudio } from "./speech";
import { GetRepairInputParams } from "./fetch-failure-types";
import { map } from "radash";

async function buildQuizPayload(card: Card) {
  return {
    cardId: card.id,
    definition: card.definition,
    term: card.term,
    definitionAudio: await generateLessonAudio({
      card: card,
      lessonType: "speaking",
      speed: 100,
    }),
    termAudio: await generateLessonAudio({
      card: card,
      lessonType: "listening",
      speed: 100,
    }),
    langCode: card.langCode,
    imageURL: (await maybeGetCardImageUrl(card.imageBlobId)) || "",
  };
}

export async function getRepairCards(p: GetRepairInputParams) {
  const { userId, /*deckId,*/ take } = p;
  await autoPromoteCards(userId);
  if (take > 45) {
    return errorReport("Too many cards requested.");
  }

  const uniqueByCardId = await prismaClient.card.findMany({
    where: {
      userId,
      // deckId,
      lastFailure: { gt: 0 },
    },
    orderBy: { lastFailure: "asc" },
    take: 10,
  });
  return map(uniqueByCardId, async (quiz) => {
    return await buildQuizPayload(quiz);
  });
}
