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

const CHEAPNESS = 2;

async function maybeAddImageToCard(card: Card) {
  if (Math.random() < 1 / CHEAPNESS) {
    // Only create images 1/6 of the time.
    return `Skipping ${card.term}`;
  }

  if (card.imageBlobId) {
    return await maybeGetCardImageUrl(card.imageBlobId);
  }

  const quizzes = await prismaClient.quiz.findMany({
    where: { cardId: card.id },
  });

  const reps = quizzes.map((x) => x.repetitions).reduce((a, b) => a + b, 0);
  if (reps < 3) {
    console.log(`Skipping ${card.term} with ${reps} reps`);
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

export async function maybeAddImages(userId: string, take: number) {
  const cards = await prismaClient.card.findMany({
    where: {
      userId,
      imageBlobId: null,
      flagged: { not: true },
    },
    take,
  });

  if (!cards.length) {
    console.log(`=== No cards left to illustrate ===`);
    return;
  }
  console.log(`=== Adding images to ${cards.length} cards ===`);
  const x = await Promise.all(cards.map(maybeAddImageToCard));
  console.log(cards.map((x) => x.term).join("\n"));
  console.log(x.join("\n"));
}
