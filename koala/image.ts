import { createDallEPrompt, createDallEImage } from "./ai";
import { prismaClient } from "./prisma-client";
import { storageProvider } from "./storage";

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

  return await storageProvider.getExpiringURL(blobID);
}

const CHEAPNESS = 1; // % of cards that will get an image.

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
  const filePath = storageProvider.createBlobID(
    "card-images",
    card.term,
    "jpg",
  );
  await storageProvider.uploadFromURL(url, filePath);
  await prismaClient.card.update({
    where: { id: card.id },
    data: { imageBlobId: filePath },
  });

  return await maybeGetCardImageUrl(filePath);
}
