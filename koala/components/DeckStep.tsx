import { DeckPicker } from "../deck-picker";
import { DeckStepProps } from "../types/create-types";

export function DeckStep({
  decks,
  state,
  dispatch,
  onNext,
}: DeckStepProps) {
  return (
    <DeckPicker
      decks={decks}
      state={state}
      dispatch={dispatch}
      onNext={onNext}
      description="You can add new cards to an existing deck or create a new one below."
    />
  );
}
