import { ClickableText } from "@/koala/components/writing-practice/ClickableText";
import { DefinitionsList } from "@/koala/components/writing-practice/DefinitionsList";
import {
  SelectedWords,
  WordDefinition,
  WritingPracticeFeedback,
} from "@/koala/components/writing-practice/types";
import {
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Title,
  Box,
  Loader,
  Alert,
} from "@mantine/core";
import { VisualDiff } from "@/koala/review/lesson-steps/visual-diff";

type FeedbackStepProps = {
  selectedPrompt: string;
  essay: string;
  corrected: string;
  feedback: WritingPracticeFeedback | null;
  selectedWords: SelectedWords;
  definitions: WordDefinition[];
  definitionsLoading: boolean;
  definitionsError: string | null;
  onToggleWord: (rawWord: string) => void;
  onExplain: () => void;
  onCreateCards: () => void;
  onWriteMore: () => void;
  onStudyCards: () => void;
};

export function FeedbackStep({
  selectedPrompt,
  essay,
  corrected,
  feedback,
  selectedWords,
  definitions,
  definitionsLoading,
  definitionsError,
  onToggleWord,
  onExplain,
  onCreateCards,
  onWriteMore,
  onStudyCards,
}: FeedbackStepProps) {
  const selectedCount = Object.keys(selectedWords).length;
  const canExplain = !definitionsLoading;
  const canCreate = definitions.length > 0 && !definitionsLoading;
  const showDefinitions = definitions.length > 0 && !definitionsLoading;

  return (
    <Paper withBorder shadow="sm" p="md" mt="md">
      <Stack gap="md">
        <Title order={3}>Feedback (Click unknown words)</Title>
        <Text fw={600}>Selected Prompt</Text>
        <ClickableText
          text={selectedPrompt}
          selectedWords={selectedWords}
          onToggleWord={onToggleWord}
        />
        <Text fw={600}>Original Text</Text>
        <ClickableText
          text={essay}
          selectedWords={selectedWords}
          onToggleWord={onToggleWord}
        />
        <Text fw={600}>Corrected Text</Text>
        <ClickableText
          text={corrected}
          selectedWords={selectedWords}
          onToggleWord={onToggleWord}
        />
        <Text fw={600}>Changes</Text>
        <VisualDiff actual={essay} expected={corrected} />

        {feedback?.feedback?.length ? (
          <Stack gap="xs">
            <Text fw={600}>Feedback</Text>
            {feedback.feedback.map((item, index) => (
              <Box key={index}>
                <ClickableText
                  text={`• ${item}`}
                  selectedWords={selectedWords}
                  onToggleWord={onToggleWord}
                />
              </Box>
            ))}
          </Stack>
        ) : null}

        <Group>
          <Button onClick={onExplain} disabled={!canExplain}>
            Explain Selected Words ({selectedCount})
          </Button>
          {canCreate ? (
            <Button onClick={onCreateCards}>
              Create Cards from Words ({definitions.length})
            </Button>
          ) : null}
          <Button onClick={onWriteMore} variant="outline">
            Write More
          </Button>
          <Button onClick={onStudyCards} variant="filled">
            Study Cards
          </Button>
        </Group>

        {definitionsLoading ? (
          <Box
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <Loader size="sm" color="blue" />
            <Text ml="sm" c="dimmed">
              Getting definitions...
            </Text>
          </Box>
        ) : null}

        {definitionsError ? (
          <Alert title="Error" color="red">
            {definitionsError}
          </Alert>
        ) : null}

        {showDefinitions ? (
          <DefinitionsList definitions={definitions} />
        ) : null}
      </Stack>
    </Paper>
  );
}
