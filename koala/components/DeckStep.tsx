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
import type { ReactNode } from "react";
import { LangCode, supportedLanguages } from "@/koala/shared-types";
import { getLangName } from "@/koala/get-lang-name";
import { DeckStepProps } from "../types/create-types";
import { buttonShadow, paperStyle, titleStyle } from "../styles";
import { DEFAULT_LANG } from "../types/create-reducer";

export function DeckStep({
  decks,
  state,
  dispatch,
  onNext,
}: DeckStepProps) {
  const theme = useMantineTheme();

  const inputStyles = {
    input: {
      borderColor: theme.colors.pink[1],
      "&:focus": { borderColor: theme.colors.pink[5] },
    },
  };

  const selectDeck = (deckId: number | undefined) => {
    dispatch({ type: "SET_DECK_ID", deckId });

    const selectedDeck = findDeckById(decks, deckId);
    if (!selectedDeck) {
      dispatch({ type: "SET_DECK_NAME", deckName: "" });
      dispatch({ type: "SET_DECK_LANG", deckLang: DEFAULT_LANG });
      return;
    }

    dispatch({ type: "SET_DECK_LANG", deckLang: selectedDeck.langCode });
    dispatch({ type: "SET_DECK_NAME", deckName: selectedDeck.name });
  };

  const setDeckSelection = (nextSelection: "existing" | "new") => {
    dispatch({ type: "SET_DECK_SELECTION", deckSelection: nextSelection });

    if (nextSelection === "new") {
      dispatch({ type: "SET_DECK_ID", deckId: undefined });
      dispatch({ type: "SET_DECK_NAME", deckName: "" });
      dispatch({ type: "SET_DECK_LANG", deckLang: DEFAULT_LANG });
      return;
    }

    if (!state.deckId) {
      dispatch({ type: "SET_DECK_NAME", deckName: "" });
      dispatch({ type: "SET_DECK_LANG", deckLang: DEFAULT_LANG });
      return;
    }

    const selectedDeck = findDeckById(decks, state.deckId);
    if (!selectedDeck) {
      dispatch({ type: "SET_DECK_ID", deckId: undefined });
      dispatch({ type: "SET_DECK_NAME", deckName: "" });
      dispatch({ type: "SET_DECK_LANG", deckLang: DEFAULT_LANG });
      return;
    }

    dispatch({ type: "SET_DECK_LANG", deckLang: selectedDeck.langCode });
    dispatch({ type: "SET_DECK_NAME", deckName: selectedDeck.name });
  };

  const deckFieldsBySelection: Record<
    DeckStepProps["state"]["deckSelection"],
    ReactNode
  > = {
    existing: (
      <ExistingDeckFields
        decks={decks}
        deckId={state.deckId}
        onSelectDeck={selectDeck}
        inputStyles={inputStyles}
        labelColor={theme.colors.gray[7]}
      />
    ),
    new: (
      <NewDeckFields
        deckName={state.deckName}
        deckLang={state.deckLang}
        onChangeDeckName={(deckName) =>
          dispatch({ type: "SET_DECK_NAME", deckName })
        }
        onChangeDeckLang={(deckLang) =>
          dispatch({ type: "SET_DECK_LANG", deckLang })
        }
        inputStyles={inputStyles}
        labelColor={theme.colors.gray[7]}
      />
    ),
  };

  const isNextDisabled = isNextDisabledForSelection(state);

  return (
    <Paper withBorder p="xl" radius="lg" style={paperStyle(theme)}>
      <Flex direction="column" gap="md">
        <Title order={3} mb="xs" style={titleStyle(theme)}>
          Step 1: Select or Create Deck
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          You can add new cards to an existing deck or create a new one
          below.
        </Text>

        <RadioGroup
          label={
            <FieldLabel text="Deck Mode" color={theme.colors.gray[7]} />
          }
          value={state.deckSelection}
          onChange={(value) => setDeckSelection(parseDeckSelection(value))}
        >
          <Radio
            value="existing"
            label="Use an existing deck"
            color="pink"
            styles={{
              radio: { cursor: "pointer" },
              label: { cursor: "pointer" },
            }}
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

        {deckFieldsBySelection[state.deckSelection]}

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

function FieldLabel(props: { text: string; color: string }) {
  const { text, color } = props;
  return (
    <Text fw={500} c={color}>
      {text}
    </Text>
  );
}

function ExistingDeckFields(props: {
  decks: DeckStepProps["decks"];
  deckId: DeckStepProps["state"]["deckId"];
  onSelectDeck: (deckId: number | undefined) => void;
  inputStyles: Record<string, unknown>;
  labelColor: string;
}) {
  const { decks, deckId, onSelectDeck, inputStyles, labelColor } = props;

  return (
    <Select
      label={<FieldLabel text="Existing Deck" color={labelColor} />}
      placeholder="Select your deck"
      value={deckId ? String(deckId) : null}
      onChange={(val) => onSelectDeck(parseDeckId(val))}
      data={decks.map((d) => ({
        label: `${d.name} (${getLangName(d.langCode)})`,
        value: String(d.id),
      }))}
      styles={inputStyles}
    />
  );
}

function NewDeckFields(props: {
  deckName: DeckStepProps["state"]["deckName"];
  deckLang: DeckStepProps["state"]["deckLang"];
  onChangeDeckName: (deckName: string) => void;
  onChangeDeckLang: (deckLang: LangCode) => void;
  inputStyles: Record<string, unknown>;
  labelColor: string;
}) {
  const {
    deckName,
    deckLang,
    onChangeDeckName,
    onChangeDeckLang,
    inputStyles,
    labelColor,
  } = props;

  return (
    <>
      <TextInput
        label={<FieldLabel text="New Deck Name" color={labelColor} />}
        placeholder="e.g. 'Spanish Travel Phrases'"
        value={deckName}
        onChange={(e) => onChangeDeckName(e.currentTarget.value)}
        styles={inputStyles}
      />
      <Select
        label={<FieldLabel text="Language" color={labelColor} />}
        placeholder="Choose language"
        value={deckLang}
        onChange={(val) => onChangeDeckLang(parseLangCode(val))}
        data={[{ value: "ko", label: supportedLanguages.ko }]}
        styles={inputStyles}
      />
    </>
  );
}

function parseDeckSelection(value: string): "existing" | "new" {
  return value === "existing" ? "existing" : "new";
}

function parseDeckId(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseLangCode(value: string | null): LangCode {
  return value === "ko" ? "ko" : DEFAULT_LANG;
}

function findDeckById(
  decks: DeckStepProps["decks"],
  deckId: number | undefined,
) {
  if (!deckId) {
    return undefined;
  }
  return decks.find((d) => d.id === deckId);
}

function isNextDisabledForSelection(state: DeckStepProps["state"]) {
  if (state.deckSelection === "existing") {
    return !state.deckId;
  }
  return state.deckName.trim() === "";
}
