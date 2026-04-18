import { Prisma } from "@prisma/client";
import { z } from "zod";

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

function normalizeSessionDescriptionSdp(value: string): string {
  const normalized = value.replace(/\r\n|\r|\n/g, "\r\n");
  if (normalized.endsWith("\r\n")) {
    return normalized;
  }

  return `${normalized}\r\n`;
}

export const directLanguageExchangeSessionDescriptionSchema = z.object({
  type: z.union([z.literal("offer"), z.literal("answer")]),
  sdp: z
    .string()
    .min(1)
    .max(200_000)
    .transform(normalizeSessionDescriptionSdp),
});

export type DirectLanguageExchangeSessionDescriptionPayload = z.infer<
  typeof directLanguageExchangeSessionDescriptionSchema
>;

export function createLanguageExchangeLinkSlug(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

export function createDirectLanguageExchangeGuestToken(): string {
  return `${crypto.randomUUID().replace(/-/g, "")}${crypto
    .randomUUID()
    .replace(/-/g, "")}`;
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
): DirectLanguageExchangeSessionDescriptionPayload | null {
  if (!value) {
    return null;
  }

  const parsed =
    directLanguageExchangeSessionDescriptionSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}
