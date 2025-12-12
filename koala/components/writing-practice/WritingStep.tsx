import { DailyWritingProgress } from "@/koala/components/writing-practice/types";
import { WritingProgressBar } from "@/koala/components/writing-practice/WritingProgressBar";
import {
  Box,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";

type WritingStepProps = {
  selectedPrompt: string;
  onSelectedPromptChange: (value: string) => void;
  essay: string;
  onEssayChange: (value: string) => void;
  loadingReview: boolean;
  progress: DailyWritingProgress | null;
  onReview: () => void;
};

export function WritingStep({
  selectedPrompt,
  onSelectedPromptChange,
  essay,
  onEssayChange,
  loadingReview,
  progress,
  onReview,
}: WritingStepProps) {
  const baseCount = progress?.progress ?? 0;
  const goal = progress?.goal ?? null;
  const currentCount = baseCount + essay.length;

  return (
    <Paper withBorder shadow="sm" p="md">
      <Title order={4} mb="xs">
        Essay Title or Prompt
      </Title>
      <Textarea
        value={selectedPrompt}
        placeholder="Optional prompt..."
        onChange={(e) => onSelectedPromptChange(e.currentTarget.value)}
        autosize
        minRows={2}
        maxRows={4}
        mb="md"
        disabled={loadingReview}
      />
      <Text size="sm" c="dimmed" mb="xs">
        Tip: Don&apos;t know a word? Surround it with question marks and it
        will be replaced with an appropriate word when graded. Example:
        ?apple?를 먹어요.
      </Text>

      <Textarea
        placeholder="Write your essay here..."
        autosize
        minRows={6}
        maxRows={12}
        value={essay}
        onChange={(e) => onEssayChange(e.currentTarget.value)}
        mb="xs"
        disabled={loadingReview}
      />

      <Box mb="md">
        <Stack gap="xs" style={{ flexGrow: 1 }}>
          <WritingProgressBar currentCount={currentCount} goal={goal} />
        </Stack>
      </Box>

      {loadingReview ? (
        <Group>
          <Loader size="sm" />
          <Text c="dimmed">Analyzing your writing...</Text>
        </Group>
      ) : (
        <Button onClick={onReview} disabled={!essay.trim()}>
          Save and Review Feedback
        </Button>
      )}
    </Paper>
  );
}
