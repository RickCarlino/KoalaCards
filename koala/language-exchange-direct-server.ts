import { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { prismaClient } from "@/koala/prisma-client";
import {
  createDirectLanguageExchangeGuestToken,
  createLanguageExchangeLinkSlug,
  DirectLanguageExchangeSessionDescriptionPayload,
  DIRECT_LANGUAGE_EXCHANGE_ACTIVE_TIMEOUT_MS,
  DIRECT_LANGUAGE_EXCHANGE_PRESENCE_TTL_MS,
  DirectLanguageExchangeAvailabilityStatus,
  getDirectLanguageExchangeActiveExpiry,
  getDirectLanguageExchangePresenceExpiry,
  getDirectLanguageExchangeRingingExpiry,
  parseLanguageExchangeSessionDescription,
} from "@/koala/language-exchange-direct";

function staleAt(now: Date, timeoutMs: number): Date {
  return new Date(now.getTime() - timeoutMs);
}

function mapDirectCall(
  call: {
    id: number;
    status: string;
    createdAt: Date;
    acceptedAt: Date | null;
    endedAt: Date | null;
    expiresAt: Date;
    offerSdp: Prisma.JsonValue | null;
    answerSdp: Prisma.JsonValue | null;
  } | null,
) {
  if (!call) {
    return null;
  }

  return {
    id: call.id,
    status: call.status,
    createdAt: call.createdAt,
    acceptedAt: call.acceptedAt,
    endedAt: call.endedAt,
    expiresAt: call.expiresAt,
    offerSdp: parseLanguageExchangeSessionDescription(call.offerSdp),
    answerSdp: parseLanguageExchangeSessionDescription(call.answerSdp),
  };
}

export type DirectLanguageExchangeCallPayload = ReturnType<
  typeof mapDirectCall
>;

async function createLanguageExchangeLink(userId: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prismaClient.languageExchangeLink.create({
        data: {
          userId,
          slug: createLanguageExchangeLinkSlug(),
        },
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing =
          await prismaClient.languageExchangeLink.findUnique({
            where: { userId },
          });
        if (existing) {
          return existing;
        }
        continue;
      }

      throw error;
    }
  }

  throw new Error("Could not create language exchange link.");
}

export async function ensureLanguageExchangeLink(userId: string) {
  const existing = await prismaClient.languageExchangeLink.findUnique({
    where: { userId },
  });
  if (existing) {
    return existing;
  }

  return createLanguageExchangeLink(userId);
}

export async function regenerateLanguageExchangeLink(userId: string) {
  const existing = await prismaClient.languageExchangeLink.findUnique({
    where: { userId },
    select: {
      id: true,
    },
  });

  if (!existing) {
    return createLanguageExchangeLink(userId);
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prismaClient.languageExchangeLink.update({
        where: { id: existing.id },
        data: {
          slug: createLanguageExchangeLinkSlug(),
        },
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Could not regenerate language exchange link.");
}

export async function findLanguageExchangeLinkBySlug(slug: string) {
  return prismaClient.languageExchangeLink.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      userId: true,
    },
  });
}

export async function upsertLanguageExchangePresence(input: {
  userId: string;
  leaseId: string;
  isVisible: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  return prismaClient.languageExchangePresence.upsert({
    where: { userId: input.userId },
    update: {
      leaseId: input.leaseId,
      isVisible: input.isVisible,
      lastSeenAt: now,
      expiresAt: getDirectLanguageExchangePresenceExpiry(now),
    },
    create: {
      userId: input.userId,
      leaseId: input.leaseId,
      isVisible: input.isVisible,
      lastSeenAt: now,
      expiresAt: getDirectLanguageExchangePresenceExpiry(now),
    },
  });
}

export async function releaseLanguageExchangePresence(input: {
  userId: string;
  leaseId: string;
}) {
  return prismaClient.languageExchangePresence.deleteMany({
    where: {
      userId: input.userId,
      leaseId: input.leaseId,
    },
  });
}

export async function expireDirectLanguageExchangeCalls(now = new Date()) {
  const staleRingingGuestAt = staleAt(
    now,
    DIRECT_LANGUAGE_EXCHANGE_PRESENCE_TTL_MS,
  );
  const staleActivePartyAt = staleAt(
    now,
    DIRECT_LANGUAGE_EXCHANGE_ACTIVE_TIMEOUT_MS,
  );

  await prismaClient.languageExchangeCall.updateMany({
    where: {
      status: "RINGING",
      OR: [
        { expiresAt: { lt: now } },
        { guestHeartbeatAt: { lt: staleRingingGuestAt } },
      ],
    },
    data: {
      status: "EXPIRED",
      endedAt: now,
    },
  });

  await prismaClient.languageExchangeCall.updateMany({
    where: {
      status: "ACTIVE",
      OR: [
        { expiresAt: { lt: now } },
        { guestHeartbeatAt: { lt: staleActivePartyAt } },
        { learnerHeartbeatAt: { lt: staleActivePartyAt } },
      ],
    },
    data: {
      status: "ENDED",
      endedAt: now,
    },
  });
}

export async function getLanguageExchangeAvailabilityStatus(input: {
  userId: string;
  now?: Date;
}): Promise<DirectLanguageExchangeAvailabilityStatus> {
  const now = input.now ?? new Date();

  const [settings, presence, liveCall] = await Promise.all([
    prismaClient.userSettings.findUnique({
      where: { userId: input.userId },
      select: {
        languageExchangeAvailable: true,
      },
    }),
    prismaClient.languageExchangePresence.findUnique({
      where: { userId: input.userId },
      select: {
        isVisible: true,
        expiresAt: true,
      },
    }),
    prismaClient.languageExchangeCall.findFirst({
      where: {
        learnerId: input.userId,
        status: {
          in: ["RINGING", "ACTIVE"],
        },
        expiresAt: { gte: now },
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (liveCall) {
    return "busy";
  }

  if (
    settings?.languageExchangeAvailable &&
    presence?.isVisible &&
    presence.expiresAt >= now
  ) {
    return "available";
  }

  return "offline";
}

export async function createDirectLanguageExchangeCall(input: {
  linkId: number;
  learnerId: string;
  offer: DirectLanguageExchangeSessionDescriptionPayload;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  return prismaClient.languageExchangeCall.create({
    data: {
      linkId: input.linkId,
      learnerId: input.learnerId,
      guestToken: createDirectLanguageExchangeGuestToken(),
      offerSdp: input.offer,
      guestHeartbeatAt: now,
      expiresAt: getDirectLanguageExchangeRingingExpiry(now),
    },
    select: {
      id: true,
      guestToken: true,
      status: true,
      createdAt: true,
      expiresAt: true,
    },
  });
}

export async function findGuestDirectLanguageExchangeCallOrNull(input: {
  callId: number;
  guestToken: string;
}) {
  return prismaClient.languageExchangeCall.findFirst({
    where: {
      id: input.callId,
      guestToken: input.guestToken,
    },
    select: {
      id: true,
      learnerId: true,
      status: true,
      createdAt: true,
      acceptedAt: true,
      endedAt: true,
      expiresAt: true,
      offerSdp: true,
      answerSdp: true,
    },
  });
}

export async function touchGuestDirectLanguageExchangeCall(input: {
  callId: number;
  guestToken: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  await prismaClient.languageExchangeCall.updateMany({
    where: {
      id: input.callId,
      guestToken: input.guestToken,
      status: "RINGING",
    },
    data: {
      guestHeartbeatAt: now,
    },
  });

  await prismaClient.languageExchangeCall.updateMany({
    where: {
      id: input.callId,
      guestToken: input.guestToken,
      status: "ACTIVE",
    },
    data: {
      guestHeartbeatAt: now,
      expiresAt: getDirectLanguageExchangeActiveExpiry(now),
    },
  });
}

export async function findIncomingDirectLanguageExchangeCallForLearner(
  userId: string,
  now = new Date(),
) {
  return prismaClient.languageExchangeCall.findFirst({
    where: {
      learnerId: userId,
      status: "RINGING",
      expiresAt: { gte: now },
    },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      status: true,
      createdAt: true,
      acceptedAt: true,
      endedAt: true,
      expiresAt: true,
      offerSdp: true,
      answerSdp: true,
    },
  });
}

export async function findActiveDirectLanguageExchangeCallForLearner(
  userId: string,
  now = new Date(),
) {
  return prismaClient.languageExchangeCall.findFirst({
    where: {
      learnerId: userId,
      status: "ACTIVE",
      expiresAt: { gte: now },
    },
    orderBy: [{ acceptedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      createdAt: true,
      acceptedAt: true,
      endedAt: true,
      expiresAt: true,
      offerSdp: true,
      answerSdp: true,
    },
  });
}

export async function touchLearnerDirectLanguageExchangeCall(input: {
  callId: number;
  learnerId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  await prismaClient.languageExchangeCall.updateMany({
    where: {
      id: input.callId,
      learnerId: input.learnerId,
      status: "ACTIVE",
    },
    data: {
      learnerHeartbeatAt: now,
      expiresAt: getDirectLanguageExchangeActiveExpiry(now),
    },
  });
}

export function mapDirectLanguageExchangeCall(
  call: {
    id: number;
    status: string;
    createdAt: Date;
    acceptedAt: Date | null;
    endedAt: Date | null;
    expiresAt: Date;
    offerSdp: Prisma.JsonValue | null;
    answerSdp: Prisma.JsonValue | null;
  } | null,
) {
  return mapDirectCall(call);
}
