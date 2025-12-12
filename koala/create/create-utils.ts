import type { LangCode } from "@/koala/shared-types";
import type {
  LanguageInputPageProps,
  State,
} from "@/koala/types/create-types";
import { getLangName } from "@/koala/get-lang-name";

type DeckSelection = State["deckSelection"];

type BulkCreateInput =
  | { deckId: number; input: State["processedCards"] }
  | {
      deckName: string;
      langCode: LangCode;
      input: State["processedCards"];
    };

export function parseNumericId(value: unknown): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function parseWordsQuery(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }
  const decoded = decodeURIComponent(value);
  return decoded
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean);
}

export function getDeckSelectionFromDecks(
  decks: LanguageInputPageProps["decks"],
): DeckSelection {
  return decks.length ? "existing" : "new";
}

export function canSaveToDeck(
  state: Pick<
    State,
    "processedCards" | "deckSelection" | "deckId" | "deckName"
  >,
) {
  if (state.processedCards.length === 0) {
    return false;
  }

  if (state.deckSelection === "existing") {
    return Boolean(state.deckId);
  }

  return Boolean(state.deckName.trim());
}

export function makeBulkCreateInput(
  state: Pick<
    State,
    "deckSelection" | "deckId" | "deckName" | "deckLang" | "processedCards"
  >,
): BulkCreateInput | undefined {
  if (state.processedCards.length === 0) {
    return undefined;
  }

  if (state.deckSelection === "existing") {
    if (!state.deckId) {
      return undefined;
    }
    return { deckId: state.deckId, input: state.processedCards };
  }

  const deckName = state.deckName.trim();
  if (!deckName) {
    return undefined;
  }

  return {
    deckName,
    langCode: state.deckLang,
    input: state.processedCards,
  };
}

export type DeckOption = { value: string; label: string };

export function makeDeckOptions(
  decks: LanguageInputPageProps["decks"],
): DeckOption[] {
  return decks.map((deck) => ({
    value: String(deck.id),
    label: `${deck.name} (${getLangName(deck.langCode)})`,
  }));
}
