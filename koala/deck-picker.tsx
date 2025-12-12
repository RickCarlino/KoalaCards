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

type DeckSelection = "existing" | "new";

interface DeckPickerState {
  deckSelection: DeckSelection;
  deckId?: number;
  deckName: string;
  deckLang: LangCode;
}

type DeckPickerAction =
  | { type: "SET_DECK_SELECTION"; deckSelection: DeckSelection }
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

function isDeckSelection(value: string): value is DeckSelection {
  return value === "existing" || value === "new";
}

function isLangCode(value: string): value is LangCode {
  return Object.prototype.hasOwnProperty.call(supportedLanguages, value);
}

function parseOptionalNumber(value: string | null) {
  if (value === null) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const theme = useMantineTheme();
  return (
    <Text fw={500} c={theme.colors.gray[7]}>
      {children}
    </Text>
  );
}

function useTextOrSelectStyles() {
  const theme = useMantineTheme();
  return {
    input: {
      borderColor: theme.colors.pink[1],
      "&:focus": {
        borderColor: theme.colors.pink[5],
      },
    },
  };
}

function DeckModePicker(props: {
  disabledExisting: boolean;
  deckSelection: DeckSelection;
  onChange: (value: DeckSelection) => void;
}) {
  return (
    <RadioGroup
      label={<FieldLabel>Deck Mode</FieldLabel>}
      value={props.deckSelection}
      onChange={(value) => {
        if (isDeckSelection(value)) {
          props.onChange(value);
        }
      }}
    >
      <Radio
        value="existing"
        label="Use an existing deck"
        color="pink"
        styles={{
          radio: { cursor: "pointer" },
          label: { cursor: "pointer" },
        }}
        disabled={props.disabledExisting}
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
  );
}

function ExistingDeckPicker(props: {
  decks: Deck[];
  deckId: number | undefined;
  onChange: (deckId: number | undefined) => void;
}) {
  const selectStyles = useTextOrSelectStyles();

  if (props.decks.length === 0) {
    return (
      <Text size="sm" c="dimmed" mt="sm">
        No existing decks found. Please create a new one.
      </Text>
    );
  }

  const value = props.deckId === undefined ? null : String(props.deckId);

  return (
    <Select
      label={<FieldLabel>Existing Deck</FieldLabel>}
      placeholder="Select your deck"
      value={value}
      onChange={(val) => props.onChange(parseOptionalNumber(val))}
      data={props.decks.map((d) => ({
        label: `${d.name} (${getLangName(d.langCode)})`,
        value: String(d.id),
      }))}
      styles={selectStyles}
      searchable
      clearable
    />
  );
}

function NewDeckFields(props: {
  deckName: string;
  deckLang: LangCode;
  onNameChange: (deckName: string) => void;
  onLangChange: (deckLang: LangCode) => void;
}) {
  const inputStyles = useTextOrSelectStyles();
  const languageOptions: Array<{ value: LangCode; label: string }> = [
    { value: "ko", label: supportedLanguages.ko },
  ];

  return (
    <>
      <TextInput
        label={<FieldLabel>New Deck Name</FieldLabel>}
        placeholder="e.g. 'Spanish Travel Phrases'"
        value={props.deckName}
        onChange={(e) => props.onNameChange(e.currentTarget.value)}
        styles={inputStyles}
      />
      <Select
        label={<FieldLabel>Language</FieldLabel>}
        placeholder="Choose language"
        value={props.deckLang}
        onChange={(val) => {
          const selected = languageOptions.find((o) => o.value === val);
          if (selected) {
            props.onLangChange(selected.value);
          }
        }}
        data={languageOptions}
        styles={inputStyles}
        searchable
      />
    </>
  );
}

function isNextDisabled(state: DeckPickerState) {
  if (state.deckSelection === "existing") {
    return state.deckId === undefined;
  }
  return state.deckName.trim().length === 0;
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
      const nextLang = isLangCode(selectedDeck.langCode)
        ? selectedDeck.langCode
        : DEFAULT_LANG;
      dispatch({
        type: "SET_DECK_LANG",
        deckLang: nextLang,
      });
      dispatch({ type: "SET_DECK_NAME", deckName: selectedDeck.name });
    } else {
      dispatch({ type: "SET_DECK_NAME", deckName: "" });
    }
  };

  const handleDeckModeChange = (value: DeckSelection) => {
    dispatch({ type: "SET_DECK_SELECTION", deckSelection: value });

    dispatch({ type: "SET_DECK_ID", deckId: undefined });
    dispatch({ type: "SET_DECK_NAME", deckName: "" });
    dispatch({ type: "SET_DECK_LANG", deckLang: DEFAULT_LANG });
  };

  const nextDisabled = isNextDisabled(state);

  const modeSection: Record<DeckSelection, React.ReactNode> = {
    existing: (
      <ExistingDeckPicker
        decks={decks}
        deckId={state.deckId}
        onChange={handleExistingDeckChange}
      />
    ),
    new: (
      <NewDeckFields
        deckName={state.deckName}
        deckLang={state.deckLang}
        onNameChange={(deckName) =>
          dispatch({ type: "SET_DECK_NAME", deckName })
        }
        onLangChange={(deckLang) =>
          dispatch({ type: "SET_DECK_LANG", deckLang })
        }
      />
    ),
  };

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

        <DeckModePicker
          disabledExisting={decks.length === 0}
          deckSelection={state.deckSelection}
          onChange={handleDeckModeChange}
        />

        {modeSection[state.deckSelection]}

        <Divider my="lg" color={theme.colors.pink[1]} />
        <Flex justify="flex-end">
          <Button
            onClick={onNext}
            disabled={nextDisabled}
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
