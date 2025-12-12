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
  const definitionsReady = !definitionsLoading && definitions.length > 0;

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

        <FeedbackList
          feedback={feedback}
          selectedWords={selectedWords}
          onToggleWord={onToggleWord}
        />

        <Group>
          <Button onClick={onExplain} disabled={!canExplain}>
            Explain Selected Words ({selectedCount})
          </Button>
          {definitionsReady ? (
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

        <DefinitionsLoader loading={definitionsLoading} />

        {definitionsError ? (
          <Alert title="Error" color="red">
            {definitionsError}
          </Alert>
        ) : null}

        {definitionsReady ? (
          <DefinitionsList definitions={definitions} />
        ) : null}
      </Stack>
    </Paper>
  );
}

function FeedbackList(props: {
  feedback: WritingPracticeFeedback | null;
  selectedWords: SelectedWords;
  onToggleWord: (rawWord: string) => void;
}) {
  const items = props.feedback?.feedback ?? [];
  if (items.length === 0) {
    return null;
  }
  return (
    <Stack gap="xs">
      <Text fw={600}>Feedback</Text>
      {items.map((item, index) => (
        <Box key={index}>
          <ClickableText
            text={`• ${item}`}
            selectedWords={props.selectedWords}
            onToggleWord={props.onToggleWord}
          />
        </Box>
      ))}
    </Stack>
  );
}

function DefinitionsLoader(props: { loading: boolean }) {
  if (!props.loading) {
    return null;
  }
  return (
    <Stack align="center" gap={4}>
      <Loader size="sm" color="blue" />
      <Text c="dimmed">Getting definitions...</Text>
    </Stack>
  );
}
