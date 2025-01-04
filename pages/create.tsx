import { useReducer, useState } from "react";
import {
  Button,
  Container,
  Paper,
  Radio,
  Select,
  Stepper,
  TextInput,
  Textarea,
  Title,
  Card,
  Divider,
  Flex,
  Overlay,
  Loader,
  RadioGroup,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { trpc } from "@/koala/trpc-config";
import { Gender, LangCode, supportedLanguages } from "@/koala/shared-types";
import { GetServerSideProps } from "next";
import { prismaClient } from "@/koala/prisma-client";
import { backfillDecks } from "@/koala/decks/backfill-decks";
import { getLangName } from "@/koala/get-lang-name";
import { draw } from "radash";
import { getServersideUser } from "@/koala/get-serverside-user";
import { useRouter } from "next/router";

type ProcessedCard = {
  term: string;
  definition: string;
  gender: Gender;
};

type Action =
  | { type: "ADD_CARD"; card: ProcessedCard }
  | { type: "EDIT_CARD"; card: ProcessedCard; index: number }
  | { type: "REMOVE_CARD"; index: number }
  | { type: "SET_PROCESSED_CARDS"; processedCards: ProcessedCard[] }
  | { type: "SET_RAW_INPUT"; rawInput: string }
  | { type: "SET_CARD_TYPE"; cardType: string }
  // New actions for deck selection
  | { type: "SET_DECK_SELECTION"; deckSelection: "existing" | "new" }
  | { type: "SET_DECK_ID"; deckId: number | undefined }
  | { type: "SET_DECK_NAME"; deckName: string }
  | { type: "SET_DECK_LANG"; deckLang: LangCode };

interface State {
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

const DEFAULT_LANG: LangCode = "ko";

const INITIAL_STATE: State = {
  deckSelection: "existing",
  deckId: undefined,
  deckName: "",
  deckLang: DEFAULT_LANG, // default to Korean if user selects "new deck" but hasn't changed
  rawInput: "",
  processedCards: [],
  cardType: "listening",
};

function reducer(state: State, action: Action): State {
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

function handleError(error: unknown) {
  console.error(error);
  notifications.show({
    title: "Error",
    message: "Something went wrong. Please report this issue if it persists.",
    color: "red",
  });
}

/* 
  STEP 1: Choose or Create Deck
*/
interface DeckStepProps {
  decks: {
    id: number;
    name: string;
    langCode: string;
  }[];
  state: State;
  dispatch: React.Dispatch<Action>;
  onNext: () => void;
}

function DeckStep({ decks, state, dispatch, onNext }: DeckStepProps) {
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

/* 
  STEP 2: Input Step
*/
interface InputStepProps {
  state: State;
  dispatch: React.Dispatch<Action>;
  onSubmit: () => void;
  loading: boolean;
}

const LANG_LEARNING_THEMES = [
  "food",
  "travel",
  "work",
  "school",
  "family",
  "shopping",
  "health",
  "weather",
  "sports",
  "hobbies",
  "music",
  "movies",
  "books",
  "technology",
  "nature",
  "animals",
  "culture",
  "history",
  "science",
  "math",
  "computers",
  "humor",
];

function InputStep({ state, dispatch, onSubmit, loading }: InputStepProps) {
  const exampleText = () => {
    const lang = getLangName(state.deckLang);
    const theme = draw(LANG_LEARNING_THEMES);
    return `Please make 10 ${lang} example sentences related to ${theme}.`;
  };

  // We now get our sample from the deckLang in state
  const pasteExample = () => {
    dispatch({
      type: "SET_RAW_INPUT",
      rawInput: exampleText(),
    });
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Flex direction="column" gap="md">
        <Title order={3}>Step 2: Input Your Learning Material</Title>
        <div style={{ fontSize: 14, color: "gray" }}>
          Paste your notes or target language phrases here. If you don't know
          what to learn, try an example by clicking the button.
        </div>

        <Button size="sm" onClick={pasteExample}>
          Don't know what to write? Try an example.
        </Button>

        <Textarea
          label="Raw Input"
          placeholder={exampleText()}
          minRows={10}
          maxRows={10}
          autosize
          value={state.rawInput}
          onChange={(e) =>
            dispatch({
              type: "SET_RAW_INPUT",
              rawInput: e.currentTarget.value,
            })
          }
        />

        <Radio.Group
          label="Card Type"
          description="Choose how you want to practice these new cards."
          value={state.cardType}
          onChange={(value) =>
            dispatch({ type: "SET_CARD_TYPE", cardType: value })
          }
        >
          <Radio
            value="listening"
            label="Listening first, then speaking (Recommended for most sentences)."
          />
          <Radio
            value="speaking"
            label="Speaking only (Good for vocab words)."
          />
          <Radio
            value="both"
            label="Do listening and speaking at the same time. (For well-understood material)."
          />
        </Radio.Group>

        <Divider my="sm" />
        <Flex justify="flex-end">
          <Button onClick={onSubmit} disabled={!state.rawInput || loading}>
            Process Input
          </Button>
        </Flex>
      </Flex>
    </Paper>
  );
}

/* 
  STEP 3: Review & Edit
*/
interface ReviewStepProps {
  state: State;
  dispatch: React.Dispatch<Action>;
  onBack: () => void;
  onSave: () => void;
  loading: boolean;
}

function ReviewStep({
  state,
  dispatch,
  onBack,
  onSave,
  loading,
}: ReviewStepProps) {
  const handleCardChange = (action: Action) => {
    dispatch(action);
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Flex direction="column" gap="md">
        <Title order={3}>Step 3: Review & Edit Cards</Title>
        <div style={{ fontSize: 14, color: "gray" }}>
          Verify each card is correct. You can edit the term or definition if
          needed, or remove cards that you don't want. When satisfied, click
          "Save Cards".
        </div>

        {state.processedCards.length === 0 && (
          <div style={{ fontSize: 14, color: "gray" }}>
            No cards to edit yet. Please go back and process input.
          </div>
        )}

        {state.processedCards.map((card, index) => (
          <Card withBorder key={index} p="sm">
            <Flex direction="column" gap="xs">
              <TextInput
                label="Term"
                value={card.term}
                onChange={(e) =>
                  handleCardChange({
                    type: "EDIT_CARD",
                    card: { ...card, term: e.currentTarget.value },
                    index,
                  })
                }
              />
              <TextInput
                label="Definition"
                value={card.definition}
                onChange={(e) =>
                  handleCardChange({
                    type: "EDIT_CARD",
                    card: { ...card, definition: e.currentTarget.value },
                    index,
                  })
                }
              />
              <Flex justify="flex-end">
                <Button
                  variant="outline"
                  color="red"
                  onClick={() =>
                    handleCardChange({ type: "REMOVE_CARD", index })
                  }
                >
                  Remove
                </Button>
              </Flex>
            </Flex>
          </Card>
        ))}

        <Divider my="sm" />
        <Flex justify="space-between">
          <Button variant="default" onClick={onBack} disabled={loading}>
            Back
          </Button>
          <Button
            onClick={onSave}
            disabled={loading || state.processedCards.length === 0}
          >
            Save Cards
          </Button>
        </Flex>
      </Flex>
    </Paper>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const dbUser = await getServersideUser(context);

  if (!dbUser) {
    return { redirect: { destination: "/api/auth/signin", permanent: false } };
  }

  // Ensure user has a default set of decks
  await backfillDecks(dbUser.id);

  // Fetch user decks
  const decks = await prismaClient.deck.findMany({
    where: {
      userId: dbUser?.id,
    },
  });

  return {
    props: {
      decks: decks.map((deck) => ({
        id: deck.id,
        name: deck.name,
        langCode: deck.langCode,
      })),
    },
  };
};

type LanguageInputPageProps = {
  decks: {
    id: number;
    name: string;
    langCode: string;
  }[];
};

const LanguageInputPage = (props: LanguageInputPageProps) => {
  const { decks } = props;
  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL_STATE,
    // Improve first time user experience:
    deckLang: (decks?.[0]?.langCode as LangCode) || INITIAL_STATE.deckLang,
    deckSelection: decks.length > 0 ? "existing" : "new",
  });
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const parseCards = trpc.parseCards.useMutation();
  const bulkCreateCards = trpc.bulkCreateCards.useMutation();

  /* Move from Step 1 (deck) -> Step 2 (input) */
  const handleDeckNext = () => {
    setActiveStep(1);
  };

  /* Process the raw input (Step 2 -> Step 3) */
  const handleRawInputSubmit = async () => {
    setLoading(true);
    try {
      const { cards } = await parseCards.mutateAsync({
        langCode: state.deckLang,
        text: state.rawInput,
      });
      dispatch({ type: "SET_PROCESSED_CARDS", processedCards: cards });
      setActiveStep(2); // Move to editing step
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  /* Save the final cards to the chosen or newly created deck (Step 3 finalize) */
  const handleSave = async () => {
    setLoading(true);
    try {
      // If existing deck, use that deck's name; otherwise, use the new deck name
      let finalDeckName = state.deckName;
      if (state.deckSelection === "existing") {
        const existingDeck = decks.find((d) => d.id === state.deckId);
        if (existingDeck) {
          finalDeckName = existingDeck.name;
        }
      }

      await bulkCreateCards.mutateAsync({
        langCode: state.deckLang,
        input: state.processedCards,
        cardType: state.cardType,
        deckName: finalDeckName, // find-or-create by deck name
      });

      // Reset and start over
      dispatch({ type: "SET_PROCESSED_CARDS", processedCards: [] });
      dispatch({ type: "SET_RAW_INPUT", rawInput: "" });
      setActiveStep(0);

      notifications.show({
        title: "Success",
        message: "Your cards have been created successfully!",
        color: "green",
      });
      router.push("/review");
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="sm" mt="xl" style={{ position: "relative" }}>
      {loading && (
        <Overlay blur={2} opacity={0.6} color="#fff" zIndex={9999}>
          <Loader size="lg" variant="dots" />
        </Overlay>
      )}

      <Title order={1} mb="lg">
        Create New Cards
      </Title>
      <Stepper active={activeStep} onStepClick={setActiveStep} mb="xl">
        <Stepper.Step label="Deck Selection">
          <DeckStep
            decks={decks}
            state={state}
            dispatch={dispatch}
            onNext={handleDeckNext}
          />
        </Stepper.Step>

        <Stepper.Step label="Input">
          <InputStep
            state={state}
            dispatch={dispatch}
            onSubmit={handleRawInputSubmit}
            loading={loading}
          />
        </Stepper.Step>

        <Stepper.Step label="Review & Edit">
          <ReviewStep
            state={state}
            dispatch={dispatch}
            onBack={() => setActiveStep(1)}
            onSave={handleSave}
            loading={loading}
          />
        </Stepper.Step>
      </Stepper>
    </Container>
  );
};

export default LanguageInputPage;
