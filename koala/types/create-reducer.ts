import { LangCode } from "@/koala/shared-types";
import { State, Action } from "./create-types";

export const DEFAULT_LANG: LangCode = "ko";

export const INITIAL_STATE: State = {
  deckSelection: "existing",
  deckId: undefined,
  deckName: "",
  deckLang: DEFAULT_LANG,
  rawInput: "",
  processedCards: [],
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "EDIT_CARD_FIELD": {
      const existing = state.processedCards[action.index];
      if (!existing) {
        return state;
      }
      const processedCards = [...state.processedCards];
      processedCards[action.index] = {
        ...existing,
        [action.field]: action.value,
      };
      return { ...state, processedCards };
    }
    case "REMOVE_CARD":
      return {
        ...state,
        processedCards: state.processedCards.filter(
          (_, i) => i !== action.index,
        ),
      };
    case "SET_PROCESSED_CARDS":
      return { ...state, processedCards: action.processedCards };
    case "SET_RAW_INPUT":
      return { ...state, rawInput: action.rawInput };
    case "SET_DECK_SELECTION":
      return { ...state, deckSelection: action.deckSelection };
    case "SET_DECK_ID":
      return { ...state, deckId: action.deckId };
    case "SET_DECK_NAME":
      return { ...state, deckName: action.deckName };
    case "SET_DECK_LANG":
      return { ...state, deckLang: action.deckLang };
    case "SET_SELECTED_DECK":
      return {
        ...state,
        deckSelection: "existing",
        deckId: action.deck.id,
        deckLang: action.deck.langCode,
        deckName: action.deck.name,
      };
    default:
      return state;
  }
}
