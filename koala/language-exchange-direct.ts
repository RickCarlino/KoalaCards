import { Prisma } from "@prisma/client";
import {
  SessionDescriptionPayload,
  sessionDescriptionSchema,
} from "@/koala/language-exchange";

export const DIRECT_LANGUAGE_EXCHANGE_PRESENCE_HEARTBEAT_MS = 10_000;
export const DIRECT_LANGUAGE_EXCHANGE_PRESENCE_TTL_MS = 30_000;
export const DIRECT_LANGUAGE_EXCHANGE_LEADER_TTL_MS = 20_000;
export const DIRECT_LANGUAGE_EXCHANGE_STATUS_POLL_INTERVAL_MS = 5_000;
export const DIRECT_LANGUAGE_EXCHANGE_INCOMING_POLL_INTERVAL_MS = 2_000;
export const DIRECT_LANGUAGE_EXCHANGE_CONNECT_POLL_INTERVAL_MS = 1_000;
export const DIRECT_LANGUAGE_EXCHANGE_RINGING_TIMEOUT_MS = 45_000;
export const DIRECT_LANGUAGE_EXCHANGE_ACTIVE_TIMEOUT_MS = 30_000;

export type DirectLanguageExchangeAvailabilityStatus =
  | "available"
  | "busy"
  | "offline";

export function createLanguageExchangeLinkSlug(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

export function getDirectLanguageExchangePresenceExpiry(
  now = new Date(),
): Date {
  return new Date(
    now.getTime() + DIRECT_LANGUAGE_EXCHANGE_PRESENCE_TTL_MS,
  );
}

export function getDirectLanguageExchangeRingingExpiry(
  now = new Date(),
): Date {
  return new Date(
    now.getTime() + DIRECT_LANGUAGE_EXCHANGE_RINGING_TIMEOUT_MS,
  );
}

export function getDirectLanguageExchangeActiveExpiry(
  now = new Date(),
): Date {
  return new Date(
    now.getTime() + DIRECT_LANGUAGE_EXCHANGE_ACTIVE_TIMEOUT_MS,
  );
}

export function parseLanguageExchangeSessionDescription(
  value: Prisma.JsonValue | null,
): SessionDescriptionPayload | null {
  if (!value) {
    return null;
  }

  const parsed = sessionDescriptionSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}
