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
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { trpc } from "@/koala/trpc-config";
import { Gender, LangCode } from "@/koala/shared-types";

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
  cardType: "listening",
};

const SAMPLES: Record<LangCode, string> = {
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
    "Grazie mille! (Thank you very much!)",
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
      const updatedCards = [...state.processedCards];
      updatedCards[action.index] = action.card;
      return { ...state, processedCards: updatedCards };
    case "REMOVE_CARD":
      return {
        ...state,
        processedCards: state.processedCards.filter(
          (_, i) => i !== action.index,
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

function handleError(error: unknown) {
  console.error(error);
  notifications.show({
    title: "Error",
    message:
      "Something went wrong. Try inputting fewer cards. Please report this issue if it persists.",
    color: "red",
  });
}

interface InputStepProps {
  state: State;
  dispatch: React.Dispatch<Action>;
  onSubmit: () => void;
  loading: boolean;
}

function InputStep({ state, dispatch, onSubmit, loading }: InputStepProps) {
  const pasteExample = () => {
    dispatch({
      type: "SET_RAW_INPUT",
      rawInput: SAMPLES[state.language] || SAMPLES["ko"],
    });
  };

  const handleLanguageChange = (language: LangCode) => {
    dispatch({ type: "SET_LANGUAGE", language });
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Flex direction="column" gap="md">
        <Title order={3}>Step 1: Input Your Content</Title>
        <div style={{ fontSize: 14, color: "gray" }}>
          Select the language of your new cards, then paste your raw text input.
          This can be plain sentences, CSV, TSV, or JSON. If you need help, try
          the example input.
        </div>

        <Select
          label="Language"
          placeholder="Choose language"
          value={state.language}
          onChange={(value) => {
            if (value) handleLanguageChange(value as LangCode);
          }}
          data={[
            { value: "ko", label: "Korean" },
            { value: "es", label: "Spanish" },
            { value: "it", label: "Italian" },
            { value: "fr", label: "French" },
          ]}
        />

        <Textarea
          label="Raw Input"
          placeholder="Paste sentences or data here..."
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

        <Button variant="subtle" size="xs" onClick={pasteExample}>
          Paste Example Input
        </Button>

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
        <Title order={3}>Step 2: Review & Edit Cards</Title>
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

export default function LanguageInputPage() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const parseCards = trpc.parseCards.useMutation();
  const bulkCreateCards = trpc.bulkCreateCards.useMutation();

  const handleRawInputSubmit = async () => {
    setLoading(true);
    try {
      const { cards } = await parseCards.mutateAsync({
        langCode: state.language,
        text: state.rawInput,
      });
      dispatch({ type: "SET_PROCESSED_CARDS", processedCards: cards });
      setActiveStep(1); // Move to editing step
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await bulkCreateCards.mutateAsync({
        langCode: state.language,
        input: state.processedCards,
        cardType: state.cardType,
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
            onBack={() => setActiveStep(0)}
            onSave={handleSave}
            loading={loading}
          />
        </Stepper.Step>
      </Stepper>
    </Container>
  );
}
