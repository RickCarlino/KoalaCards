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

const CHEAPNESS = 8; // Roughly 12% of cards will get an image.

export async function maybeAddImageToCard(card: Card) {
  if (card.imageBlobId) {
    return
  }

  if (Math.random() < 1 / CHEAPNESS) {
    return;
  }

  if (card.imageBlobId) {
    return await maybeGetCardImageUrl(card.imageBlobId);
  }

  const quizzes = await prismaClient.quiz.findMany({
    where: { cardId: card.id },
  });

  const reps = quizzes.map((x) => x.repetitions).reduce((a, b) => a + b, 0);
  if (reps < 3) {
    return;
  }

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
