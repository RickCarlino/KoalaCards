import { Stack, Text, Button } from "@mantine/core";
import { CardImage } from "./CardImage";
import { HOTKEYS } from "../hotkeys";
import { FeedbackVote } from "./FeedbackVote";

interface FailureViewProps {
  imageURL?: string;
  term: string;
  definition: string;
  userTranscription: string;
  feedback?: string;
  quizResultId?: number | null;
  onContinue: () => void;
  failureText?: string;
}

export const FailureView: React.FC<FailureViewProps> = ({
  imageURL,
  term,
  definition,
  userTranscription,
  feedback,
  quizResultId,
  onContinue,
  failureText = "Not quite right",
}) => {
  return (
    <Stack align="center" gap="md">
      <CardImage imageURL={imageURL} definition={definition} />

      <Text ta="center" c="red" fw={500} size="lg">
        {failureText}
      </Text>

      <Text size="xl" fw={700} ta="center">
        {term}
      </Text>

      <Text ta="center">{definition}</Text>

      <Button onClick={onContinue} variant="light" color="blue">
        Continue ({HOTKEYS.CONTINUE})
      </Button>

      <Text ta="center" size="sm" c="dimmed">
        You said: "{userTranscription}"
      </Text>

      {renderFeedbackSection(feedback, quizResultId, onContinue)}

      <Text ta="center" c="dimmed" mt="md">
        We'll review this again later.
      </Text>
    </Stack>
  );
};

function renderFeedbackSection(
  feedback?: string,
  quizResultId?: number | null,
  onContinue?: () => void,
) {
  if (!feedback) {
    return null;
  }
  return (
    <Stack gap={4} align="center">
      <Text ta="center" c="dimmed">
        {feedback}
      </Text>
      {quizResultId && (
        <FeedbackVote resultId={quizResultId} onClick={onContinue} />
      )}
    </Stack>
  );
}
