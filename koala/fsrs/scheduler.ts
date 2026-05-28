import type { Prisma } from "@prisma/client";
import { fsrs, generatorParameters, type FSRSParameters } from "ts-fsrs";
import { z } from "zod";
import { resolveRequestedRetention } from "../settings/requested-retention.ts";
import { DEFAULT_SCHEDULER_FLAGS, TS_FSRS_VERSION } from "./constants.ts";

const stepSchema = z.string().regex(/^\d+(\.\d+)?[mhd]$/);

const schedulerFlagsSchema = z.object({
  enable_fuzz: z.boolean(),
  enable_short_term: z.boolean(),
});

const fsrsParametersSchema = z.object({
  request_retention: z.number().finite().min(0).max(1),
  maximum_interval: z.number().finite().positive(),
  w: z.array(z.number().finite()).refine((value) => {
    return [17, 19, 21].includes(value.length);
  }, "FSRS parameter weights must have 17, 19, or 21 entries."),
  enable_fuzz: z.boolean(),
  enable_short_term: z.boolean(),
  learning_steps: z.array(stepSchema),
  relearning_steps: z.array(stepSchema),
});

export type SchedulerFlags = z.infer<typeof schedulerFlagsSchema>;

export type ResolvedDeckScheduler = {
  deckId: number;
  configId: number;
  requestedRetention: number;
  parameters: FSRSParameters;
  flags: SchedulerFlags;
  tsFsrsVersion: string;
  updatedAt: Date;
  cacheKey: string;
};

export type SerializedFsrsParameters = {
  request_retention: number;
  maximum_interval: number;
  w: number[];
  enable_fuzz: boolean;
  enable_short_term: boolean;
  learning_steps: string[];
  relearning_steps: string[];
};

export type SerializedDeckScheduler = {
  deckId: number;
  configId: number;
  requestedRetention: number;
  parameters: SerializedFsrsParameters;
  flags: SchedulerFlags;
  tsFsrsVersion: string;
  updatedAt: string;
  cacheKey: string;
};

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

export const buildDefaultFsrsParameters = (
  requestedRetention?: number,
): FSRSParameters =>
  generatorParameters({
    request_retention: resolveRequestedRetention(requestedRetention),
    ...DEFAULT_SCHEDULER_FLAGS,
  });

export function serializeFsrsParameters(
  parameters: FSRSParameters,
): SerializedFsrsParameters {
  return {
    request_retention: parameters.request_retention,
    maximum_interval: parameters.maximum_interval,
    w: [...parameters.w],
    enable_fuzz: parameters.enable_fuzz,
    enable_short_term: parameters.enable_short_term,
    learning_steps: [...parameters.learning_steps],
    relearning_steps: [...parameters.relearning_steps],
  };
}

export function fsrsParametersJson(
  parameters: FSRSParameters,
): Prisma.InputJsonObject {
  return serializeFsrsParameters(parameters);
}

export const buildDeckFsrsConfigCreateInput = (input: {
  userId: string;
  deckId: number;
  requestedRetention?: number;
}): Prisma.DeckFsrsConfigUncheckedCreateInput => {
  const requestedRetention = resolveRequestedRetention(
    input.requestedRetention,
  );
  return {
    userId: input.userId,
    deckId: input.deckId,
    requestedRetention,
    parametersJson: fsrsParametersJson(
      buildDefaultFsrsParameters(requestedRetention),
    ),
    parametersSource: "default",
    tsFsrsVersion: TS_FSRS_VERSION,
    schedulerFlagsJson: DEFAULT_SCHEDULER_FLAGS,
    logsSinceOptimize: 0,
    eligibleLogCount: 0,
    optimizerStatus: "idle",
  };
};

export function validateSchedulerFlags(value: unknown): SchedulerFlags {
  return schedulerFlagsSchema.parse(value);
}

export function validateFsrsParameters(value: unknown): FSRSParameters {
  const parsed = fsrsParametersSchema.parse(value);
  const parameters = parsed as FSRSParameters;
  fsrs(parameters);
  return parameters;
}

export function serializeDeckScheduler(
  scheduler: ResolvedDeckScheduler,
): SerializedDeckScheduler {
  return {
    deckId: scheduler.deckId,
    configId: scheduler.configId,
    requestedRetention: scheduler.requestedRetention,
    parameters: serializeFsrsParameters(scheduler.parameters),
    flags: scheduler.flags,
    tsFsrsVersion: scheduler.tsFsrsVersion,
    updatedAt: scheduler.updatedAt.toISOString(),
    cacheKey: scheduler.cacheKey,
  };
}

export function deserializeDeckScheduler(
  scheduler: SerializedDeckScheduler,
): ResolvedDeckScheduler {
  return {
    ...scheduler,
    parameters: validateFsrsParameters(scheduler.parameters),
    updatedAt: new Date(scheduler.updatedAt),
  };
}

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
  client?: SchedulerClient,
): Promise<ResolvedDeckScheduler> {
  const schedulerClient =
    client ?? (await import("../prisma-client.ts")).prismaClient;
  const config = await ensureDeckFsrsConfig(schedulerClient, input);
  return toResolvedScheduler(config);
}

export function getFsrsInstance(scheduler: {
  cacheKey: string;
  parameters: FSRSParameters;
}) {
  const cached = fsrsCache.get(scheduler.cacheKey);
  if (cached) {
    return cached;
  }
  const instance = fsrs(scheduler.parameters);
  fsrsCache.set(scheduler.cacheKey, instance);
  return instance;
}

const fsrsCache = new Map<string, ReturnType<typeof fsrs>>();
