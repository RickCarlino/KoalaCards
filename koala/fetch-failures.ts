import { prismaClient } from "@/koala/prisma-client";
import { Card } from "@prisma/client";
import { errorReport } from "./error-report";
import { maybeGetCardImageUrl } from "./image";
import { generateDefinitionAudio, generateTermAudio } from "./speech";
import { GetRepairInputParams } from "./fetch-failure-types";
import { map } from "radash";

async function buildQuizPayload(card: Card) {
  const definitionAudio = await generateDefinitionAudio(card.definition);
  const termAudio = await generateTermAudio({ card, speed: 100 });
  return {
    cardId: card.id,
    definition: card.definition,
    term: card.term,
    definitionAudio,
    termAudio,
    langCode: "ko",
    imageURL: (await maybeGetCardImageUrl(card.imageBlobId)) || "",
  };
}

export async function getRepairCards(p: GetRepairInputParams) {
  const { userId, take } = p;
  if (take > 45) {
    return errorReport("Too many cards requested.");
  }

  const uniqueByCardId = await prismaClient.card.findMany({
    where: {
      userId,
      lastFailure: { gt: 0 },
    },
    orderBy: { lastFailure: "asc" },
    take: 10,
  });
  return map(uniqueByCardId, async (quiz) => {
    return await buildQuizPayload(quiz);
  });
}
