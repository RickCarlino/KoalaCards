import React from "react";
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
  Text,
  useMantineTheme,
} from "@mantine/core";
import { LangCode, supportedLanguages } from "./shared-types"; // Adjusted path
import { getLangName } from "./get-lang-name"; // Adjusted path
import { buttonShadow, paperStyle, titleStyle } from "./styles"; // Adjusted path
import { DEFAULT_LANG } from "./types/create-reducer";

// --- Define types specific to DeckPicker ---

// Define Deck type locally (or import if moved to a shared location)
export interface Deck {
  id: number;
  name: string;
  langCode: string;
}

// Define relevant state parts needed by the picker
interface DeckPickerState {
  deckSelection: "existing" | "new";
  deckId?: number;
  deckName: string;
  deckLang: LangCode;
}

// Define relevant action types the picker needs to dispatch
type DeckPickerAction =
  | { type: "SET_DECK_SELECTION"; deckSelection: "existing" | "new" }
  | { type: "SET_DECK_ID"; deckId: number | undefined }
  | { type: "SET_DECK_NAME"; deckName: string }
  | { type: "SET_DECK_LANG"; deckLang: LangCode };

// Define the props for the new component
interface DeckPickerProps {
  decks: Deck[];
  state: DeckPickerState;
  dispatch: React.Dispatch<DeckPickerAction>;
  onNext: () => void; // Keep onNext for now, assuming similar step logic
  title?: string; // Optional title override
}

// --- DeckPicker Component ---

export function DeckPicker({
  decks,
  state,
  dispatch,
  onNext,
  title = "Step 1: Select or Create Deck", // Default title
}: DeckPickerProps) {
  const theme = useMantineTheme();

  // Handler for picking an existing deck
  const handleExistingDeckChange = (deckId: number | undefined) => {
    dispatch({ type: "SET_DECK_ID", deckId });
    const selectedDeck = decks.find((d) => d.id === deckId);
    if (selectedDeck) {
      dispatch({
        type: "SET_DECK_LANG",
        deckLang: selectedDeck.langCode as LangCode,
      });
      // Automatically set the deck name when an existing deck is selected
      dispatch({ type: "SET_DECK_NAME", deckName: selectedDeck.name });
    } else {
      // Clear deck name if selection is cleared
      dispatch({ type: "SET_DECK_NAME", deckName: "" });
    }
  };

  // Handler for switching between "existing" vs "new" deck
  const handleDeckModeChange = (value: "existing" | "new") => {
    dispatch({ type: "SET_DECK_SELECTION", deckSelection: value });

    // Reset fields based on mode change
    dispatch({ type: "SET_DECK_ID", deckId: undefined });
    dispatch({ type: "SET_DECK_NAME", deckName: "" });
    dispatch({ type: "SET_DECK_LANG", deckLang: DEFAULT_LANG });

    // If switching back to existing and there are decks, select the first one?
    // Or leave it blank? Let's leave it blank for now.
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
    <Paper withBorder p="xl" radius="lg" style={paperStyle(theme)}>
      <Flex direction="column" gap="md">
        <Title order={3} mb="xs" style={titleStyle(theme)}>
          {title}
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          You can add new items to an existing deck or create a new one
          below.
        </Text>

        <RadioGroup
          label={
            <Text fw={500} c={theme.colors.gray[7]}>
              Deck Mode
            </Text>
          }
          value={state.deckSelection}
          onChange={(value) =>
            handleDeckModeChange(value as "existing" | "new")
          }
        >
          <Radio
            value="existing"
            label="Use an existing deck"
            color="pink"
            styles={{
              radio: { cursor: "pointer" },
              label: { cursor: "pointer" },
            }}
            disabled={decks.length === 0} // Disable if no decks exist
          />
          <Radio
            value="new"
            label="Create a new deck"
            color="pink"
            styles={{
              radio: { cursor: "pointer" },
              label: { cursor: "pointer" },
            }}
          />
        </RadioGroup>

        {state.deckSelection === "existing" && decks.length > 0 && (
          <Select
            label={
              <Text fw={500} c={theme.colors.gray[7]}>
                Existing Deck
              </Text>
            }
            placeholder="Select your deck"
            value={state.deckId ? String(state.deckId) : null}
            onChange={(val) =>
              handleExistingDeckChange(val ? Number(val) : undefined)
            } // Handle null case
            data={decks.map((d) => ({
              label: `${d.name} (${getLangName(d.langCode)})`,
              value: String(d.id),
            }))}
            styles={{
              input: {
                borderColor: theme.colors.pink[1],
                "&:focus": {
                  borderColor: theme.colors.pink[5],
                },
              },
            }}
            searchable
            clearable // Allow clearing the selection
          />
        )}
        {state.deckSelection === "existing" && decks.length === 0 && (
          <Text size="sm" c="dimmed" mt="sm">
            No existing decks found. Please create a new one.
          </Text>
        )}

        {state.deckSelection === "new" && (
          <>
            <TextInput
              label={
                <Text fw={500} c={theme.colors.gray[7]}>
                  New Deck Name
                </Text>
              }
              placeholder="e.g. 'Spanish Travel Phrases'"
              value={state.deckName}
              onChange={(e) =>
                dispatch({
                  type: "SET_DECK_NAME",
                  deckName: e.currentTarget.value,
                })
              }
              styles={{
                input: {
                  borderColor: theme.colors.pink[1],
                  "&:focus": {
                    borderColor: theme.colors.pink[5],
                  },
                },
              }}
            />
            <Select
              label={
                <Text fw={500} c={theme.colors.gray[7]}>
                  Language
                </Text>
              }
              placeholder="Choose language"
              value={state.deckLang}
              onChange={(val) =>
                dispatch({
                  type: "SET_DECK_LANG",
                  deckLang: val as LangCode,
                })
              }
              data={Object.keys(supportedLanguages)
                .sort()
                .filter((langCode) => langCode !== "en") // Exclude English
                .map((langCode) => ({
                  label: supportedLanguages[langCode as LangCode],
                  value: langCode,
                }))}
              styles={{
                input: {
                  borderColor: theme.colors.pink[1],
                  "&:focus": {
                    borderColor: theme.colors.pink[5],
                  },
                },
              }}
              searchable
            />
          </>
        )}

        <Divider my="lg" color={theme.colors.pink[1]} />
        <Flex justify="flex-end">
          <Button
            onClick={onNext}
            disabled={isNextDisabled}
            color="pink"
            radius="md"
            size="md"
            style={buttonShadow}
          >
            Next
          </Button>
        </Flex>
      </Flex>
    </Paper>
  );
}
