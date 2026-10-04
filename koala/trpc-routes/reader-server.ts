import { TRPCError } from "@trpc/server";
import { prismaClient } from "@/koala/prisma-client";
import type { ReaderResourceKind } from "@/koala/reader/contracts";
import { resolveReaderOwnership } from "@/koala/reader/ownership";

export function requireReaderUserId(userId?: string): string {
  if (!userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User not authenticated.",
    });
  }

  return userId;
}

export async function requireOwnedReaderResource(options: {
  kind: ReaderResourceKind;
  publicId: string;
  userId: string;
}): Promise<{ id: number }> {
  if (options.kind === "article") {
    const article = await prismaClient.readerArticle.findUnique({
      where: { publicId: options.publicId },
      select: { id: true, userId: true },
    });
    return requireOwnedRecord(article, "Article", options.userId);
  }

  const book = await prismaClient.readerBook.findUnique({
    where: { publicId: options.publicId },
    select: { id: true, userId: true },
  });
  return requireOwnedRecord(book, "Book", options.userId);
}

export async function requireOwnedReaderDeck(options: {
  deckId: number;
  userId: string;
}): Promise<number> {
  const deck = await prismaClient.deck.findFirst({
    where: {
      id: options.deckId,
      userId: options.userId,
    },
    select: { id: true },
  });

  if (!deck) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Deck not found.",
    });
  }

  return deck.id;
}

function requireOwnedRecord(
  record: { id: number; userId: string } | null,
  label: "Article" | "Book",
  userId: string,
): { id: number } {
  const ownership = resolveReaderOwnership(record, userId);
  if (ownership.status === "missing") {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `${label} not found.`,
    });
  }

  if (ownership.status === "forbidden") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `${label} not owned by current user.`,
    });
  }

  return { id: ownership.id };
}
