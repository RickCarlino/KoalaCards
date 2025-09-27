import { createDallEImage, createDallEPrompt } from "./dall-e";
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

const CHEAPNESS = 0.1; // % of cards that will get an image.

export async function maybeAddImageToCard(card: Card) {
  if (card.imageBlobId) {
    return;
  }

  const cardCount = await prismaClient.card.count({
    where: {
      userId: card.userId
    },
  });

  const proceed = cardCount < 15 || Math.random() < CHEAPNESS;

  if (!proceed) {
    return;
  }

  const prompt = await createDallEPrompt(card.definition, card.term);
  const base64 = await createDallEImage(prompt);
  const filePath = storageProvider.createBlobID(
    "card-images",
    card.term,
    "jpg",
  );
  await storageProvider.uploadFromBase64(base64, filePath);
  await prismaClient.card.update({
    where: { id: card.id },
    data: { imageBlobId: filePath },
  });

  return await maybeGetCardImageUrl(filePath);
}
