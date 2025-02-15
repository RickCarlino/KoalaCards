import { Gender, LangCode } from "@/koala/shared-types";

export interface ProcessedCard {
  term: string;
  definition: string;
  gender: Gender;
}

export interface Deck {
  id: number;
  name: string;
  langCode: string;
}

// Main state and action types
export interface State {
  // Deck selection
  deckSelection: "existing" | "new";
  deckId?: number; // if using an existing deck
  deckName: string; // if creating a new deck
  deckLang: LangCode; // always store the final deck language

  // Card creation
  rawInput: string;
  processedCards: ProcessedCard[];
  cardType: string; // listening, speaking, both
}

export type Action =
  | { type: "ADD_CARD"; card: ProcessedCard }
  | { type: "EDIT_CARD"; card: ProcessedCard; index: number }
  | { type: "REMOVE_CARD"; index: number }
  | { type: "SET_PROCESSED_CARDS"; processedCards: ProcessedCard[] }
  | { type: "SET_RAW_INPUT"; rawInput: string }
  | { type: "SET_CARD_TYPE"; cardType: string }
  | { type: "SET_DECK_SELECTION"; deckSelection: "existing" | "new" }
  | { type: "SET_DECK_ID"; deckId: number | undefined }
  | { type: "SET_DECK_NAME"; deckName: string }
  | { type: "SET_DECK_LANG"; deckLang: LangCode };

// Component-specific action types
export type DeckAction = 
  | { type: "SET_DECK_SELECTION"; deckSelection: "existing" | "new" }
  | { type: "SET_DECK_ID"; deckId: number | undefined }
  | { type: "SET_DECK_NAME"; deckName: string }
  | { type: "SET_DECK_LANG"; deckLang: LangCode };

export type InputAction =
  | { type: "SET_RAW_INPUT"; rawInput: string }
  | { type: "SET_CARD_TYPE"; cardType: string };

export type ReviewAction =
  | { type: "EDIT_CARD"; card: ProcessedCard; index: number }
  | { type: "REMOVE_CARD"; index: number };

// Component Props interfaces
export interface DeckStepProps {
  decks: Deck[];
  state: Pick<State, "deckSelection" | "deckId" | "deckName" | "deckLang">;
  dispatch: React.Dispatch<DeckAction>;
  onNext: () => void;
}

export interface InputStepProps {
  state: Pick<State, "deckLang" | "rawInput" | "cardType">;
  dispatch: React.Dispatch<InputAction>;
  onSubmit: () => void;
  loading: boolean;
}

export interface ReviewStepProps {
  state: Pick<State, "processedCards">;
  dispatch: React.Dispatch<ReviewAction>;
  onBack: () => void;
  onSave: () => void;
  loading: boolean;
}

export interface LanguageInputPageProps {
  decks: Deck[];
}
