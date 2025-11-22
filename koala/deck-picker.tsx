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
import { LangCode, supportedLanguages } from "./shared-types";
import { getLangName } from "./get-lang-name";
import { buttonShadow, paperStyle, titleStyle } from "./styles";
import { DEFAULT_LANG } from "./types/create-reducer";

export interface Deck {
  id: number;
  name: string;
  langCode: string;
}

interface DeckPickerState {
  deckSelection: "existing" | "new";
  deckId?: number;
  deckName: string;
  deckLang: LangCode;
}

type DeckPickerAction =
  | { type: "SET_DECK_SELECTION"; deckSelection: "existing" | "new" }
  | { type: "SET_DECK_ID"; deckId: number | undefined }
  | { type: "SET_DECK_NAME"; deckName: string }
  | { type: "SET_DECK_LANG"; deckLang: LangCode };

interface DeckPickerProps {
  decks: Deck[];
  state: DeckPickerState;
  dispatch: React.Dispatch<DeckPickerAction>;
  onNext: () => void;
  title?: string;
}

export function DeckPicker({
  decks,
  state,
  dispatch,
  onNext,
  title = "Step 1: Select or Create Deck",
}: DeckPickerProps) {
  const theme = useMantineTheme();

  const handleExistingDeckChange = (deckId: number | undefined) => {
    dispatch({ type: "SET_DECK_ID", deckId });
    const selectedDeck = decks.find((d) => d.id === deckId);
    if (selectedDeck) {
      dispatch({
        type: "SET_DECK_LANG",
        deckLang: selectedDeck.langCode as LangCode,
      });
      dispatch({ type: "SET_DECK_NAME", deckName: selectedDeck.name });
    } else {
      dispatch({ type: "SET_DECK_NAME", deckName: "" });
    }
  };

  const handleDeckModeChange = (value: "existing" | "new") => {
    dispatch({ type: "SET_DECK_SELECTION", deckSelection: value });

    dispatch({ type: "SET_DECK_ID", deckId: undefined });
    dispatch({ type: "SET_DECK_NAME", deckName: "" });
    dispatch({ type: "SET_DECK_LANG", deckLang: DEFAULT_LANG });
  };

  const isNextDisabled = (() => {
    if (state.deckSelection === "existing") {
      return !state.deckId;
    } else {
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
            disabled={decks.length === 0}
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
            }
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
            clearable
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
              data={[{ value: "ko", label: supportedLanguages.ko }]}
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
