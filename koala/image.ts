import { createDallEPrompt, createDallEImage } from "./openai";
import { prismaClient } from "./prisma-client";
import {
  bucket,
  createBlobID,
  expiringUrl,
  storeURLGoogleCloud,
} from "./storage";

// fetcher will just show images if present.
type Card = {
  id: number;
  term: string;
  definition: string;
  imageBlobId: string | null;
};

export async function maybeGetCardImageUrl(
  blobID: string | null,
): Promise<string | undefined> {
  if (!blobID) {
    return;
  }

  return await expiringUrl(bucket.file(blobID));
}

const CHEAPNESS = 80; // % of cards that will get an image.

export async function maybeAddImageToCard(card: Card) {
  if (card.imageBlobId) {
    return;
  }

  if (Math.random() < CHEAPNESS / 100) {
    return;
  }

  // const quizzes = await prismaClient.quiz.findMany({
  //   where: { cardId: card.id },
  // });

  // const reps = quizzes.map((x) => x.repetitions).reduce((a, b) => a + b, 0);
  // if (reps < 1) {
  //   return;
  // }

  const prompt = await createDallEPrompt(card.definition, card.term);
  const url = await createDallEImage(prompt);
  const filePath = createBlobID("card-images", card.term, "jpg");
  await storeURLGoogleCloud(url, filePath);
  await prismaClient.card.update({
    where: { id: card.id },
    data: { imageBlobId: filePath },
  });

  return await maybeGetCardImageUrl(filePath);
}
