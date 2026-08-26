import { DirectLanguageExchangeSessionDescriptionPayload } from "@/koala/language-exchange-direct";

export const DIRECT_LANGUAGE_EXCHANGE_LEADER_STORAGE_KEY =
  "koala.languageExchangeDirect.leader";

export type DirectLanguageExchangeCallState = {
  id: number;
  status:
    "RINGING" | "ACTIVE" | "ENDED" | "DECLINED" | "CANCELLED" | "EXPIRED";
  createdAt: string;
  acceptedAt: string | null;
  endedAt: string | null;
  expiresAt: string;
  offerSdp: DirectLanguageExchangeSessionDescriptionPayload | null;
  answerSdp: DirectLanguageExchangeSessionDescriptionPayload | null;
};

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export async function readJsonOrThrow<T>(response: Response): Promise<T> {
  const json = (await response.json()) as {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(json.error || "Request failed.");
  }

  return json as T;
}
