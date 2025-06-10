import { Stack, Text, Image, Button } from "@mantine/core";

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
      {imageURL && (
        <Image
          src={imageURL}
          alt={`Image: ${term}`}
          maw="100%"
          mah={240}
          fit="contain"
        />
      )}

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
        Continue
      </Button>
    </Stack>
  );
};