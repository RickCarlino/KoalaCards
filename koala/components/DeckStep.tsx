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
import { LangCode, supportedLanguages } from "@/koala/shared-types";
import { getLangName } from "@/koala/get-lang-name";
import { DeckStepProps } from "../types/create-types";
import { buttonShadow, paperStyle, titleStyle } from "../styles";

const DEFAULT_LANG: LangCode = "ko";

export function DeckStep({
  decks,
  state,
  dispatch,
  onNext,
}: DeckStepProps) {
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

        {state.deckSelection === "existing" && (
          <Select
            label={
              <Text fw={500} c={theme.colors.gray[7]}>
                Existing Deck
              </Text>
            }
            placeholder="Select your deck"
            value={state.deckId ? String(state.deckId) : null}
            onChange={(val) => handleExistingDeckChange(Number(val))}
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
          />
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
                .filter((langCode) => langCode !== "en")
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
