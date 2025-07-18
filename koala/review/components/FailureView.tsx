import { Stack, Text, Button } from "@mantine/core";
import { CardImage } from "./CardImage";
import { HOTKEYS } from "../hotkeys";

interface FailureViewProps {
  imageURL?: string;
  term: string;
  definition: string;
  userTranscription: string;
  feedback?: string;
  onContinue: () => void;
  failureText?: string;
}

export const FailureView: React.FC<FailureViewProps> = ({
  imageURL,
  term,
  definition,
  userTranscription,
  feedback,
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

      <Text ta="center" size="sm" c="dimmed">
        You said: "{userTranscription}"
      </Text>

      {feedback && (
        <Text ta="center" c="dimmed">
          {feedback}
        </Text>
      )}

      <Text ta="center" c="dimmed" mt="md">
        We'll review this again later.
      </Text>

      <Button onClick={onContinue} variant="light" color="blue">
        Continue ({HOTKEYS.CONTINUE})
      </Button>
    </Stack>
  );
};
