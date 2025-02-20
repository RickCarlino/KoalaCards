import {
  Button,
  Paper,
  Radio,
  Select,
  Title,
  Divider,
  Flex,
  RadioGroup,
  TextInput,
} from "@mantine/core";
import { LangCode, supportedLanguages } from "@/koala/shared-types";
import { getLangName } from "@/koala/get-lang-name";
import { DeckStepProps } from "../types/create-types";

const DEFAULT_LANG: LangCode = "ko";

export function DeckStep({ decks, state, dispatch, onNext }: DeckStepProps) {
  // Handler for picking an existing deck
  const handleExistingDeckChange = (deckId: number | undefined) => {
    dispatch({ type: "SET_DECK_ID", deckId });
    const selectedDeck = decks.find((d) => d.id === deckId);
    if (selectedDeck) {
      dispatch({
        type: "SET_DECK_LANG",
        deckLang: selectedDeck.langCode as LangCode,
      });
      dispatch({ type: "SET_DECK_NAME", deckName: selectedDeck.name });
    }
  };

  // Handler for switching between "existing" vs "new" deck
  const handleDeckModeChange = (value: "existing" | "new") => {
    dispatch({ type: "SET_DECK_SELECTION", deckSelection: value });

    if (value === "existing") {
      // Reset new-deck fields
      dispatch({ type: "SET_DECK_NAME", deckName: "" });
      dispatch({ type: "SET_DECK_LANG", deckLang: DEFAULT_LANG });
    } else {
      // Reset existing-deck fields
      dispatch({ type: "SET_DECK_ID", deckId: undefined });
      dispatch({ type: "SET_DECK_NAME", deckName: "" });
      dispatch({ type: "SET_DECK_LANG", deckLang: DEFAULT_LANG });
    }
  };

  // Check if "Next" is disabled
  const isNextDisabled = (() => {
    if (state.deckSelection === "existing") {
      return !state.deckId; // must have chosen an existing deck
    } else {
      // must have a deck name if creating a new deck
      return !state.deckName.trim();
    }
  })();

  return (
    <Paper withBorder p="md" radius="md">
      <Flex direction="column" gap="md">
        <Title order={3}>Step 1: Select or Create Deck</Title>
        <div style={{ fontSize: 14, color: "gray" }}>
          You can add new cards to an existing deck or create a new one below.
        </div>

        <RadioGroup
          label="Deck Mode"
          value={state.deckSelection}
          onChange={(value) =>
            handleDeckModeChange(value as "existing" | "new")
          }
        >
          <Radio value="existing" label="Use an existing deck" />
          <Radio value="new" label="Create a new deck" />
        </RadioGroup>

        {state.deckSelection === "existing" && (
          <Select
            label="Existing Deck"
            placeholder="Select your deck"
            value={state.deckId ? String(state.deckId) : null}
            onChange={(val) => handleExistingDeckChange(Number(val))}
            data={decks.map((d) => ({
              label: `${d.name} (${getLangName(d.langCode)})`,
              value: String(d.id),
            }))}
          />
        )}

        {state.deckSelection === "new" && (
          <>
            <TextInput
              label="New Deck Name"
              placeholder="e.g. 'Spanish Travel Phrases'"
              value={state.deckName}
              onChange={(e) =>
                dispatch({
                  type: "SET_DECK_NAME",
                  deckName: e.currentTarget.value,
                })
              }
            />
            <Select
              label="Language"
              placeholder="Choose language"
              value={state.deckLang}
              onChange={(val) =>
                dispatch({ type: "SET_DECK_LANG", deckLang: val as LangCode })
              }
              data={Object.keys(supportedLanguages)
                .sort()
                .filter((langCode) => langCode !== "en")
                .map((langCode) => ({
                  label: supportedLanguages[langCode as LangCode],
                  value: langCode,
                }))}
            />
          </>
        )}

        <Divider my="sm" />
        <Flex justify="flex-end">
          <Button onClick={onNext} disabled={isNextDisabled}>
            Next
          </Button>
        </Flex>
      </Flex>
    </Paper>
  );
}
