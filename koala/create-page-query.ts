export type CreatePageMode = "vibe" | "wordlist" | "csv";

type CreatePageDeck = {
  id: number;
  name: string;
  langCode: string;
};

export type CreatePageRouteState = {
  mode: CreatePageMode | null;
  selectedDeck: CreatePageDeck | null;
  words: string[];
};

function firstQueryValue(
  value: string | string[] | undefined,
): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return null;
}

function resolveMode(value: string | null): CreatePageMode | null {
  if (value === "vibe" || value === "wordlist" || value === "csv") {
    return value;
  }
  return null;
}

function resolveSelectedDeck(
  deckValue: string | null,
  decks: CreatePageDeck[],
): CreatePageDeck | null {
  const parsedDeckId = Number(deckValue);
  if (!Number.isFinite(parsedDeckId)) {
    return null;
  }
  return decks.find((deck) => deck.id === parsedDeckId) ?? null;
}

function parseWords(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return decodeURIComponent(value)
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean);
}

export function parseCreatePageRoute(
  query: Record<string, string | string[] | undefined>,
  decks: CreatePageDeck[],
): CreatePageRouteState {
  const deckValue =
    firstQueryValue(query.deckId) ?? firstQueryValue(query.deck_id);

  return {
    mode: resolveMode(firstQueryValue(query.mode)),
    selectedDeck: resolveSelectedDeck(deckValue, decks),
    words: parseWords(firstQueryValue(query.words)),
  };
}
