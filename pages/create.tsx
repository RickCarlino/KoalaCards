import { useState, useReducer } from "react";
import {
  Stepper,
  Select,
  Textarea,
  Button,
  Group,
  TextInput,
} from "@mantine/core";
import { trpc } from "@/koala/trpc-config";
type ProcessedCard = {
  term: string;
  definition: string;
  gender: "M" | "F" | "N";
};

type LangCode = "ko" | "es" | "it" | "fr";

type Action =
  | { type: "ADD_CARD"; card: ProcessedCard }
  | { type: "EDIT_CARD"; card: ProcessedCard; index: number }
  | { type: "REMOVE_CARD"; index: number }
  | { type: "SET_LANGUAGE"; language: LangCode }
  | { type: "SET_PROCESSED_CARDS"; processedCards: ProcessedCard[] }
  | { type: "SET_RAW_INPUT"; rawInput: string };

interface State {
  language: LangCode;
  rawInput: string;
  processedCards: ProcessedCard[];
}

const INITIAL_STATE: State = {
  language: "ko",
  rawInput: "",
  processedCards: [],
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_CARD":
      return {
        ...state,
        processedCards: [...state.processedCards, action.card],
      };
    case "EDIT_CARD":
      const newCards = [...state.processedCards];
      newCards[action.index] = action.card;
      return { ...state, processedCards: newCards };
    case "REMOVE_CARD":
      return {
        ...state,
        processedCards: state.processedCards.filter(
          (_card, index) => index !== action.index,
        ),
      };
    case "SET_LANGUAGE":
      return { ...state, language: action.language };
    case "SET_PROCESSED_CARDS":
      return { ...state, processedCards: action.processedCards };
    case "SET_RAW_INPUT":
      return { ...state, rawInput: action.rawInput };
    default:
      return state;
  }
}

function LanguageInputPage() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const parseCards = trpc.parseCards.useMutation();
  const bulkCreateCards = trpc.bulkCreateCards.useMutation();

  // Handler for language selection
  const handleLanguageChange = (language: LangCode) => {
    dispatch({ type: "SET_LANGUAGE", language });
  };

  // Handler for raw input submission
  const handleRawInputSubmit = async () => {
    setLoading(true);
    parseCards
      .mutateAsync({
        text: state.rawInput,
      })
      .then(({ cards }) => {
        dispatch({ type: "SET_PROCESSED_CARDS", processedCards: cards });
        setActiveStep((current) => current + 1);
      })
      .catch((error) => {
        console.error(error);
        alert("Error???");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Handler for adding, editing, and removing cards
  const handleCardChange = (action: Action) => {
    dispatch(action);
  };

  // Save the processed cards
  const handleSave = async () => {
    setLoading(true);
    bulkCreateCards
      .mutateAsync({
        langCode: state.language,
        input: state.processedCards,
      })
      .then(() => {
        // Reset and start over:
        dispatch({ type: "SET_PROCESSED_CARDS", processedCards: [] });
        dispatch({ type: "SET_RAW_INPUT", rawInput: "" });
        setActiveStep(0);
      })
      .catch((error) => {
        console.error(error);
        alert("Error???");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <Stepper active={activeStep} onStepClick={setActiveStep}>
      <Stepper.Step label="Select language">
        <Select
          label="Language"
          placeholder="Choose"
          value={state.language}
          onChange={(value) => value && handleLanguageChange(value as LangCode)}
          data={[
            { value: "ko", label: "Korean" },
            { value: "es", label: "Spanish" },
            { value: "it", label: "Italian" },
            { value: "fr", label: "French" },
          ]}
        />
        <Button onClick={() => setActiveStep((current) => current + 1)}>
          Next
        </Button>
      </Stepper.Step>
      <Stepper.Step label="Input text">
        <Textarea
          label="Paste your text here"
          autosize
          minRows={5}
          value={state.rawInput}
          onChange={(event) =>
            dispatch({
              type: "SET_RAW_INPUT",
              rawInput: event.currentTarget.value,
            })
          }
        />
        <Button onClick={handleRawInputSubmit} loading={loading}>
          Process
        </Button>
      </Stepper.Step>
      <Stepper.Step label="Edit cards">
        {state.processedCards.map((card, index) => (
          <Group key={index}>
            <TextInput
              value={card.term}
              onChange={(event) =>
                handleCardChange({
                  type: "EDIT_CARD",
                  card: { ...card, term: event.currentTarget.value },
                  index,
                })
              }
            />
            <TextInput
              value={card.definition}
              onChange={(event) =>
                handleCardChange({
                  type: "EDIT_CARD",
                  card: { ...card, definition: event.currentTarget.value },
                  index,
                })
              }
            />
            <Button
              color="red"
              onClick={() => handleCardChange({ type: "REMOVE_CARD", index })}
            >
              Remove
            </Button>
          </Group>
        ))}
        <Button onClick={handleSave} loading={loading}>
          Save
        </Button>
      </Stepper.Step>
    </Stepper>
  );
}

export default LanguageInputPage;
