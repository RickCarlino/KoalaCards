import { z } from "zod";

export const LANGUAGE_EXCHANGE_PRESENCE_WINDOW_MS = 45_000;
export const LANGUAGE_EXCHANGE_POLL_INTERVAL_MS = 5_000;
export const LANGUAGE_EXCHANGE_CONNECT_POLL_INTERVAL_MS = 1_000;
export const LANGUAGE_EXCHANGE_WAITING_TIMEOUT_MS = 2 * 60 * 1_000;
export const LANGUAGE_EXCHANGE_CALL_TIMEOUT_MS = 15 * 60 * 1_000;

export function debugLanguageExchange(
  _event: string,
  _data?: Record<string, unknown>,
): void {
  return;
}

function normalizeSessionDescriptionSdp(value: string): string {
  const normalized = value.replace(/\r\n|\r|\n/g, "\r\n");
  if (normalized.endsWith("\r\n")) {
    return normalized;
  }

  return `${normalized}\r\n`;
}

export const sessionDescriptionSchema = z.object({
  type: z.union([z.literal("offer"), z.literal("answer")]),
  sdp: z
    .string()
    .min(1)
    .max(200_000)
    .transform(normalizeSessionDescriptionSdp),
});

export type SessionDescriptionPayload = z.infer<
  typeof sessionDescriptionSchema
>;

export function createLanguageExchangeGuestToken(): string {
  return `${crypto.randomUUID().replace(/-/g, "")}${crypto
    .randomUUID()
    .replace(/-/g, "")}`;
}

export function getWaitingRequestExpiry(now = new Date()): Date {
  return new Date(now.getTime() + LANGUAGE_EXCHANGE_WAITING_TIMEOUT_MS);
}

export function getMatchedRequestExpiry(now = new Date()): Date {
  return new Date(now.getTime() + LANGUAGE_EXCHANGE_CALL_TIMEOUT_MS);
}
