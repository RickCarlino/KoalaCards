import { bucket, expiringUrl } from "./storage";

// fetcher will just show images if present.
type Card = {
  imageBlobId: string | null;
};

export async function maybeGetCardImageUrl(
  card: Card,
): Promise<string | undefined> {
  const blobID = card.imageBlobId;

  if (!blobID) {
    return;
  }

  return await expiringUrl(bucket.file(blobID));
}
