import {
  Button,
  Paper,
  Title,
  Divider,
  Flex,
  Text,
  Textarea,
  useMantineTheme,
} from "@mantine/core";
import { draw } from "radash";
import { getLangName } from "@/koala/get-lang-name";
import { InputStepProps } from "../types/create-types";
import { buttonShadow, paperStyle, titleStyle } from "../styles";

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
  const theme = useMantineTheme();

  const exampleText = () => {
    const lang = getLangName(state.deckLang);
    const topic = draw(LANG_LEARNING_THEMES);
    return `Please make 25 ${lang} example sentences related to ${topic}.`;
  };

  const pasteExample = () => {
    dispatch({
      type: "SET_RAW_INPUT",
      rawInput: exampleText(),
    });
  };

  return (
    <Paper withBorder p="xl" radius="lg" style={paperStyle(theme)}>
      <Flex direction="column" gap="md">
        <Title order={3} mb="xs" style={titleStyle(theme)}>
          Step 2: Input Your Learning Material
        </Title>

        <Text size="sm" c={theme.colors.gray[7]} mb="xs">
          Paste a list of language phrases or vocabulary here. If you don't
          know what to learn, try an example by clicking the button.
        </Text>

        <Text size="sm" c={theme.colors.gray[7]} mb="md">
          <b>
            Koala is built for self-study learners who have a textbook or
            language course to follow.
          </b>{" "}
          If you don't have material of your own, that's OK. Koala can
          generate content for you to study. Click the button below until
          you find a topic that is interesting to you.
        </Text>

        <Button
          size="md"
          onClick={pasteExample}
          color="pink"
          radius="md"
          style={{
            ...buttonShadow,
            alignSelf: "center",
            marginBottom: "10px",
          }}
        >
          Generate Random Cards Instead 🎲
        </Button>

        <Textarea
          label={
            <Text fw={500} c={theme.colors.gray[7]}>
              Raw Input
            </Text>
          }
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
          styles={{
            input: {
              borderColor: theme.colors.pink[1],
              "&:focus": {
                borderColor: theme.colors.pink[5],
              },
            },
          }}
        />

        <Divider my="lg" color={theme.colors.pink[1]} />

        <Flex justify="flex-end">
          <Button
            onClick={onSubmit}
            disabled={!state.rawInput || loading}
            color="pink"
            radius="md"
            size="md"
            style={buttonShadow}
          >
            Process Input
          </Button>
        </Flex>
      </Flex>
    </Paper>
  );
}
