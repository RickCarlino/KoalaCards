import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { getUserSettings } from "@/koala/auth-helpers";
import { prismaClient } from "@/koala/prisma-client";

export function requireRouteUserId(
  userId: string | null | undefined,
): string {
  if (!userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User not found",
    });
  }

  return userId;
}

function deckNotFoundError(): TRPCError {
  return new TRPCError({
    code: "NOT_FOUND",
    message: "Deck not found",
  });
}

export async function requireOwnedDeck<
  T extends Prisma.DeckFindUniqueArgs,
>(
  args: T & { where: Prisma.DeckWhereUniqueInput },
): Promise<NonNullable<Prisma.DeckGetPayload<T>>> {
  const deck = await prismaClient.deck.findUnique(args);
  if (!deck) {
    throw deckNotFoundError();
  }

  return deck as NonNullable<Prisma.DeckGetPayload<T>>;
}

export async function findOwnedCard(options: {
  cardId: number | undefined;
  userId: string;
}) {
  return prismaClient.card.findFirst({
    where: {
      id: options.cardId,
      userId: options.userId,
    },
  });
}

export async function getSettingsUserId(
  userId: string | number | null | undefined,
): Promise<string> {
  return (await getUserSettings(userId)).user.id;
}

export async function requireOwnedCard(options: {
  cardId: number;
  userId: string;
}) {
  return prismaClient.card.findFirstOrThrow({
    where: {
      id: options.cardId,
      userId: options.userId,
    },
  });
}
