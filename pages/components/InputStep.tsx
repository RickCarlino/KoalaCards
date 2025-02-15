import {
  Button,
  Paper,
  Radio,
  Title,
  Divider,
  Flex,
  Text,
  Textarea,
} from "@mantine/core";
import { draw } from "radash";
import { getLangName } from "@/koala/get-lang-name";
import { InputStepProps } from "../types/create-types";

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

export function InputStep({
  state,
  dispatch,
  onSubmit,
  loading,
}: InputStepProps) {
  const exampleText = () => {
    const lang = getLangName(state.deckLang);
    const theme = draw(LANG_LEARNING_THEMES);
    return `Please make 25 ${lang} example sentences related to ${theme}.`;
  };

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
        <Text size="sm">
          Paste a list of language phrases or vocabulary here. If you don't know
          what to learn, try an example by clicking the button.
        </Text>
        <Text size="sm">
          Koala is built for self-study learners who have a textbook or language
          course to follow. If you don't have material of your own, that's OK.
          Koala can generate content for you to study. Click the button below
          until you find a topic that is interesting to you.
        </Text>
        <Button size="sm" onClick={pasteExample}>
          Generate Learning Content 🎲
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
