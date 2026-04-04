import { LanguageExchangeRequest, Prisma } from "@prisma/client";
import { prismaClient } from "@/koala/prisma-client";
import {
  createLanguageExchangeGuestToken,
  getMatchedRequestExpiry,
  getWaitingRequestExpiry,
  LANGUAGE_EXCHANGE_PRESENCE_WINDOW_MS,
} from "@/koala/language-exchange";

const freshCutoff = (now = new Date()) => {
  return new Date(now.getTime() - LANGUAGE_EXCHANGE_PRESENCE_WINDOW_MS);
};

export async function expireStaleLanguageExchangeRequests(
  now = new Date(),
): Promise<void> {
  const staleAt = freshCutoff(now);

  await prismaClient.languageExchangeRequest.updateMany({
    where: {
      status: "WAITING",
      OR: [
        { expiresAt: { lt: now } },
        { guestHeartbeatAt: { lt: staleAt } },
      ],
    },
    data: {
      status: "EXPIRED",
      endedAt: now,
    },
  });

  await prismaClient.languageExchangeRequest.updateMany({
    where: {
      status: "MATCHED",
      OR: [
        { expiresAt: { lt: now } },
        { guestHeartbeatAt: { lt: staleAt } },
        { learnerHeartbeatAt: { lt: staleAt } },
      ],
    },
    data: {
      status: "ENDED",
      endedAt: now,
    },
  });
}

export async function countAvailableLanguageExchangeLearners(
  now = new Date(),
): Promise<number> {
  const cutoff = freshCutoff(now);

  return prismaClient.user.count({
    where: {
      languageExchangePresenceAt: { gte: cutoff },
      userSettings: {
        is: {
          languageExchangeAvailable: true,
        },
      },
      answeredLanguageExchangeRequests: {
        none: {
          status: "MATCHED",
          learnerHeartbeatAt: { gte: cutoff },
        },
      },
    },
  });
}

export async function createLanguageExchangeRequest(
  now = new Date(),
): Promise<LanguageExchangeRequest> {
  return prismaClient.languageExchangeRequest.create({
    data: {
      guestToken: createLanguageExchangeGuestToken(),
      expiresAt: getWaitingRequestExpiry(now),
      guestHeartbeatAt: now,
    },
  });
}

export async function getGuestLanguageExchangeRequestOrNull(input: {
  requestId: number;
  guestToken: string;
}): Promise<LanguageExchangeRequest | null> {
  return prismaClient.languageExchangeRequest.findFirst({
    where: {
      id: input.requestId,
      guestToken: input.guestToken,
    },
  });
}

export async function touchGuestLanguageExchangeRequest(input: {
  requestId: number;
  status: "WAITING" | "MATCHED";
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  await prismaClient.languageExchangeRequest.updateMany({
    where: {
      id: input.requestId,
      status: input.status,
    },
    data: {
      guestHeartbeatAt: now,
      expiresAt:
        input.status === "MATCHED"
          ? getMatchedRequestExpiry(now)
          : getWaitingRequestExpiry(now),
    },
  });
}

export async function touchLearnerLanguageExchangePresence(input: {
  userId: string;
  requestId?: number | null;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();

  await prismaClient.user.update({
    where: { id: input.userId },
    data: {
      languageExchangePresenceAt: now,
    },
  });

  if (!input.requestId) {
    return;
  }

  await prismaClient.languageExchangeRequest.updateMany({
    where: {
      id: input.requestId,
      claimedByUserId: input.userId,
      status: "MATCHED",
    },
    data: {
      learnerHeartbeatAt: now,
      expiresAt: getMatchedRequestExpiry(now),
    },
  });
}

export function getNextWaitingLanguageExchangeWhere(now = new Date()) {
  const cutoff = freshCutoff(now);

  return {
    status: "WAITING",
    expiresAt: { gte: now },
    guestHeartbeatAt: { gte: cutoff },
  } satisfies Prisma.LanguageExchangeRequestWhereInput;
}

export async function findNextWaitingLanguageExchangeRequest(
  now = new Date(),
): Promise<LanguageExchangeRequest | null> {
  return prismaClient.languageExchangeRequest.findFirst({
    where: getNextWaitingLanguageExchangeWhere(now),
    orderBy: [{ createdAt: "asc" }],
  });
}
