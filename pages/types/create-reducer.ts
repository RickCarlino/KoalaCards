import { LangCode } from "@/koala/shared-types";
import { State, Action } from "./create-types";

export const DEFAULT_LANG: LangCode = "ko";

export const INITIAL_STATE: State = {
  deckSelection: "existing",
  deckId: undefined,
  deckName: "",
  deckLang: DEFAULT_LANG, // default to Korean if user selects "new deck" but hasn't changed
  rawInput: "",
  processedCards: [],
  cardType: "listening",
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_CARD":
      return {
        ...state,
        processedCards: [...state.processedCards, action.card],
      };
    case "EDIT_CARD": {
      const updatedCards = [...state.processedCards];
      updatedCards[action.index] = action.card;
      return { ...state, processedCards: updatedCards };
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
    case "SET_CARD_TYPE":
      return { ...state, cardType: action.cardType };
    // New deck-related actions
    case "SET_DECK_SELECTION":
      return { ...state, deckSelection: action.deckSelection };
    case "SET_DECK_ID":
      return { ...state, deckId: action.deckId };
    case "SET_DECK_NAME":
      return { ...state, deckName: action.deckName };
    case "SET_DECK_LANG":
      return { ...state, deckLang: action.deckLang };
    default:
      return state;
  }
}
