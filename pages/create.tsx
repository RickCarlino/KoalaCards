import { Gender, LangCode } from "@/koala/shared-types";
import { trpc } from "@/koala/trpc-config";
import {
  Button,
  Container,
  Group,
  Radio,
  Select,
  Stepper,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useReducer, useState } from "react";
type ProcessedCard = {
  term: string;
  definition: string;
  gender: Gender;
};

type Action =
  | { type: "ADD_CARD"; card: ProcessedCard }
  | { type: "EDIT_CARD"; card: ProcessedCard; index: number }
  | { type: "REMOVE_CARD"; index: number }
  | { type: "SET_LANGUAGE"; language: LangCode }
  | { type: "SET_PROCESSED_CARDS"; processedCards: ProcessedCard[] }
  | { type: "SET_RAW_INPUT"; rawInput: string }
  | { type: "SET_CARD_TYPE"; cardType: string };

interface State {
  language: LangCode;
  rawInput: string;
  processedCards: ProcessedCard[];
  cardType: string;
}

const INITIAL_STATE: State = {
  language: "ko",
  rawInput: "",
  processedCards: [],
  cardType: "both",
};

const errorHandler = (error: any) => {
  console.error(error);
  alert(
    "Error. Please try again or report this on Github if the error continues.",
  );
};

const SAMPLES = {
  ko: [
    "안녕하세요? (Hello, how are you?)",
    "저는 학생입니다. (I am a student.)",
    "한국어를 배우고 있어요. (I am learning Korean.)",
    "감사합니다! (Thank you!)",
    "이것은 얼마입니까? (How much is this?)",
  ].join("\n"),
  es: [
    "¿Cómo estás? (How are you?)",
    "Soy profesor. (I am a teacher.)",
    "Estoy aprendiendo español. (I am learning Spanish.)",
    "¡Muchas gracias! (Thank you very much!)",
    "¿Cuánto cuesta esto? (How much does this cost?)",
  ].join("\n"),
  it: [
    "Come stai? (How are you?)",
    "Sono uno studente. (I am a student.)",
    "Sto imparando l'italiano. (I am learning Italian.)",
    "Grazie mille! (Thank",
    "you very much!)",
    "Quanto costa questo? (How much does this cost?)",
  ].join("\n"),
  fr: [
    "Comment ça va ? (How are you?)",
    "Je suis enseignant. (I am a teacher.)",
    "J'apprends le français. (I am learning French.)",
    "Merci beaucoup ! (Thank you very much!)",
    "Combien coûte ceci ? (How much does this cost?)",
  ].join("\n"),
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
    case "SET_CARD_TYPE":
      return { ...state, cardType: action.cardType };
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
        langCode: state.language,
        text: state.rawInput,
      })
      .then(({ cards }) => {
        dispatch({ type: "SET_PROCESSED_CARDS", processedCards: cards });
        setActiveStep((current) => current + 1);
      })
      .catch(errorHandler)
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
        cardType: state.cardType,
      })
      .then(() => {
        // Reset and start over:
        dispatch({ type: "SET_PROCESSED_CARDS", processedCards: [] });
        dispatch({ type: "SET_RAW_INPUT", rawInput: "" });
        setActiveStep(0);
      })
      .catch(errorHandler)
      .finally(() => {
        setLoading(false);
      });
  };

  const pasteExample = () => {
    dispatch({
      type: "SET_RAW_INPUT",
      rawInput: SAMPLES[state.language] || SAMPLES["ko"],
    });
  };
  return (
    <Container size="sm">
      <h1>Create New Cards</h1>
      <Stepper active={activeStep} onStepClick={setActiveStep}>
        <Stepper.Step label="Select language">
          <Select
            label="Language"
            placeholder="Choose"
            value={state.language}
            onChange={(selection) => {
              const value = selection || state.language;
              value && handleLanguageChange(value as LangCode);
            }}
            data={[
              { value: "ko", label: "Korean" },
              { value: "es", label: "Spanish" },
              { value: "it", label: "Italian" },
              { value: "fr", label: "French" },
            ]}
          />
          <Button
            disabled={!state.language}
            onClick={() => {
              setActiveStep((current) => current + 1);
            }}
          >
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
          <p>
            NOTE: Cards can be input in most computer readable text formats such
            as CSV, TSV, JSON. Ensure that each entry has a target language
            phrase and an English translation. Koala Cards will figure out the
            rest.
          </p>
          <Button size="xs" onClick={pasteExample}>
            Paste Example Input
          </Button>
        </Stepper.Step>
        <Stepper.Step label="Set card type">
          <Radio.Group
            label="Select the type of cards"
            value={state.cardType}
            onChange={(value) =>
              dispatch({ type: "SET_CARD_TYPE", cardType: value })
            }
          >
            <Radio
              value="listening"
              label="Listening only - Good for long sentences."
            />
            <Radio
              value="speaking"
              label="Speaking only - Good for single words and set words (colors, numbers)"
            />
            <Radio
              value="both"
              label="Both - Good for medium length phrases and sentences"
            />
          </Radio.Group>
          <Button
            disabled={!state.cardType}
            onClick={() => setActiveStep((current) => current + 1)}
          >
            Next
          </Button>
        </Stepper.Step>
        <Stepper.Step label="Edit cards">
          <Button onClick={handleSave} loading={loading}>
            Save
          </Button>
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
        </Stepper.Step>
      </Stepper>
    </Container>
  );
}

export default LanguageInputPage;
