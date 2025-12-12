import { Gender, LangCode } from "@/koala/shared-types";

export interface ProcessedCard {
  term: string;
  definition: string;
  gender: Gender;
}

export interface Deck {
  id: number;
  name: string;
  langCode: LangCode;
}

export type DeckSummary = Deck;

export interface State {
  deckSelection: "existing" | "new";
  deckId?: number;
  deckName: string;
  deckLang: LangCode;

  rawInput: string;
  processedCards: ProcessedCard[];
}

export type Action =
  | {
      type: "EDIT_CARD_FIELD";
      index: number;
      field: "term" | "definition";
      value: string;
    }
  | { type: "REMOVE_CARD"; index: number }
  | { type: "SET_PROCESSED_CARDS"; processedCards: ProcessedCard[] }
  | { type: "SET_RAW_INPUT"; rawInput: string }
  | { type: "SET_DECK_SELECTION"; deckSelection: "existing" | "new" }
  | { type: "SET_DECK_ID"; deckId: number | undefined }
  | { type: "SET_DECK_NAME"; deckName: string }
  | { type: "SET_DECK_LANG"; deckLang: LangCode }
  | { type: "SET_SELECTED_DECK"; deck: DeckSummary };

export interface LanguageInputPageProps {
  decks: Deck[];
}

export type ParsedRow = { term: string; definition: string };
