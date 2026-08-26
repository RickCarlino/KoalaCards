import type { Prisma } from "@/koala/generated/prisma/client";
import { prismaClient } from "@/koala/prisma-client";
import { resolveRequestedRetention } from "@/koala/settings/requested-retention";
import {
  buildDeckFsrsConfigCreateInput,
  type ResolvedDeckScheduler,
  validateFsrsParameters,
  validateSchedulerFlags,
} from "./scheduler";

type DeckSchedulerRow = {
  id: number;
  deckId: number;
  requestedRetention: number;
  parametersJson: Prisma.JsonValue;
  schedulerFlagsJson: Prisma.JsonValue;
  tsFsrsVersion: string;
  updatedAt: Date;
};

type SchedulerClient = Pick<
  Prisma.TransactionClient,
  "deck" | "deckFsrsConfig" | "userSettings"
>;

function toResolvedScheduler(
  row: DeckSchedulerRow,
): ResolvedDeckScheduler {
  const flags = validateSchedulerFlags(row.schedulerFlagsJson);
  const parameters = validateFsrsParameters({
    ...validateFsrsParameters(row.parametersJson),
    request_retention: resolveRequestedRetention(row.requestedRetention),
    ...flags,
  });

  return {
    deckId: row.deckId,
    configId: row.id,
    requestedRetention: resolveRequestedRetention(row.requestedRetention),
    parameters,
    flags,
    tsFsrsVersion: row.tsFsrsVersion,
    updatedAt: row.updatedAt,
    cacheKey: `${row.id}:${row.updatedAt.toISOString()}`,
  };
}

async function getUserRequestedRetention(
  client: SchedulerClient,
  userId: string,
): Promise<number> {
  const settings = await client.userSettings.findUnique({
    where: { userId },
    select: { requestedRetention: true },
  });
  return resolveRequestedRetention(settings?.requestedRetention);
}

export async function ensureDeckFsrsConfig(
  client: SchedulerClient,
  input: { userId: string; deckId: number },
) {
  const existing = await client.deckFsrsConfig.findUnique({
    where: { deckId: input.deckId },
  });
  if (existing) {
    if (existing.userId !== input.userId) {
      throw new Error("Deck scheduler does not belong to this user.");
    }
    return existing;
  }

  const deck = await client.deck.findUnique({
    where: { id: input.deckId, userId: input.userId },
    select: { id: true },
  });
  if (!deck) {
    throw new Error("Deck not found.");
  }

  const requestedRetention = await getUserRequestedRetention(
    client,
    input.userId,
  );
  return client.deckFsrsConfig.create({
    data: buildDeckFsrsConfigCreateInput({
      userId: input.userId,
      deckId: input.deckId,
      requestedRetention,
    }),
  });
}

export async function resolveDeckScheduler(
  input: { userId: string; deckId: number },
  client: SchedulerClient = prismaClient,
): Promise<ResolvedDeckScheduler> {
  const config = await ensureDeckFsrsConfig(client, input);
  return toResolvedScheduler(config);
}
