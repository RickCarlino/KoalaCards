import {
  getDeckSelectionFromDecks,
  parseNumericId,
} from "@/koala/create/create-utils";
import { DEFAULT_LANG_CODE, type Gender } from "@/koala/shared-types";
import { INITIAL_STATE } from "@/koala/types/create-reducer";
import type {
  DeckSummary,
  LanguageInputPageProps,
  ParsedRow,
  State,
} from "@/koala/types/create-types";

const DEFAULT_CARD_GENDER: Gender = "N";

export function initCreateState(
  decks: LanguageInputPageProps["decks"],
): State {
  const firstDeck = decks[0];
  return {
    ...INITIAL_STATE,
    deckLang: firstDeck?.langCode ?? DEFAULT_LANG_CODE,
    deckSelection: getDeckSelectionFromDecks(decks),
    deckId: firstDeck?.id,
    deckName: firstDeck?.name ?? "",
  };
}

export function toInputLines(rawInput: string): string[] {
  return rawInput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 1500);
}

export function toParsedRows(
  lines: string[],
  separator: string,
): ParsedRow[] {
  return lines.map((line) => {
    const parts = line.split(separator);
    const term = parts[0]?.trim() ?? "";
    const definition = parts.slice(1).join(separator).trim();
    return { term, definition };
  });
}

function getDeckIdFromQuery(
  query: Record<string, unknown>,
): number | undefined {
  const deckIdQuery = query.deckId ?? query.deck_id;
  return parseNumericId(deckIdQuery);
}

export function findDeckFromQuery(
  query: Record<string, unknown>,
  decks: DeckSummary[],
): DeckSummary | undefined {
  const deckId = getDeckIdFromQuery(query);
  if (deckId === undefined) {
    return undefined;
  }
  return decks.find((deck) => deck.id === deckId);
}

export function findDeckByInput(
  decks: DeckSummary[],
  value: string | null,
): DeckSummary | undefined {
  const deckId = parseNumericId(value);
  if (deckId === undefined) {
    return undefined;
  }
  return decks.find((deck) => deck.id === deckId);
}

export function withDefaultGender(
  card: Omit<State["processedCards"][number], "gender">,
): State["processedCards"][number] {
  return { ...card, gender: DEFAULT_CARD_GENDER };
}

export function toProcessedCardsFromParsedRows(
  rows: ParsedRow[],
): State["processedCards"] {
  return rows
    .filter((row) => row.term && row.definition)
    .map((row) => withDefaultGender(row));
}
