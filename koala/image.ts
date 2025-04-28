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
  userId: string;
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

  const cardCount = await prismaClient.card.count({
    where: {
      userId: card.userId,
      imageBlobId: { not: null },
    },
  });

  const cheap = Math.random() < CHEAPNESS / 100;
  const skip = cardCount < 50 ? false : cheap;

  if (skip) {
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
