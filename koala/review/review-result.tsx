import type { ReactNode } from "react";
import {
  Box,
  Button,
  Divider,
  Group,
  Kbd,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { Rating, type Grade } from "ts-fsrs";

export function ReviewResult({
  isCorrect,
  feedback,
  definition,
  transcription,
  answer,
  explanation,
  children,
}: {
  isCorrect: boolean;
  feedback: string;
  definition: string;
  transcription: string;
  answer?: string;
  explanation?: ReactNode;
  children: ReactNode;
}) {
  const StatusIcon = isCorrect ? IconCircleCheck : IconCircleX;
  return (
    <Stack gap="lg" w="100%" maw={520} miw={0}>
      <Group gap="xs" c={isCorrect ? "green.8" : "red.8"} role="status">
        <StatusIcon size={22} aria-hidden />
        <Text fw={600} c="pastel.7">
          {feedback}
        </Text>
      </Group>
      <Stack gap="md">
        <Text size="sm" c="pastel.6" style={{ overflowWrap: "anywhere" }}>
          {definition}
        </Text>
        {transcription.trim() && (
          <Stack gap={4}>
            <Text size="xs" c="pastel.6">
              Your answer
            </Text>
            <Text
              fz="xl"
              fw={500}
              lang="ko"
              style={{ overflowWrap: "anywhere" }}
            >
              {transcription}
            </Text>
          </Stack>
        )}
        {answer && (
          <Stack gap={4}>
            <Text size="xs" c="pastel.6">
              One possible answer
            </Text>
            <Text
              fz="xl"
              fw={500}
              lang="ko"
              style={{ overflowWrap: "anywhere" }}
            >
              {answer}
            </Text>
          </Stack>
        )}
      </Stack>
      {explanation}
      <Divider color="pastel.2" />
      {children}
    </Stack>
  );
}

const gradeLabels: Record<Grade, string> = {
  [Rating.Again]: "Again",
  [Rating.Hard]: "Hard",
  [Rating.Good]: "Good",
  [Rating.Easy]: "Easy",
};

export function ReviewRatingButtons({
  options,
  hotkeys,
  isLoading,
  onSelect,
}: {
  options: [Grade, string][];
  hotkeys: Record<Grade, string>;
  isLoading?: boolean;
  onSelect: (grade: Grade) => void;
}) {
  return (
    <Stack gap="sm" aria-busy={isLoading}>
      <Group justify="space-between" gap="xs">
        <Text size="sm" fw={500}>
          How difficult was this?
        </Text>
        <Text size="xs" c="pastel.6">
          Next review
        </Text>
      </Group>
      <SimpleGrid cols={2} spacing="xs">
        {options.map(([grade, interval]) => (
          <Button
            key={grade}
            variant="default"
            h={76}
            px="md"
            radius="sm"
            disabled={isLoading}
            onClick={() => onSelect(grade)}
            aria-label={`${gradeLabels[grade]}, next review: ${interval}`}
            aria-keyshortcuts={hotkeys[grade]}
            styles={{
              label: { width: "100%" },
              root: { textAlign: "left" },
            }}
          >
            <Box component="span" w="100%">
              <Group
                component="span"
                justify="space-between"
                wrap="nowrap"
                gap="xs"
              >
                <Text component="span" size="sm" fw={600}>
                  {gradeLabels[grade]}
                </Text>
                <Kbd size="xs" aria-hidden>
                  {hotkeys[grade].toUpperCase()}
                </Kbd>
              </Group>
              <Text
                component="span"
                display="block"
                size="xs"
                c="pastel.6"
                fw={400}
                mt={4}
              >
                {interval}
              </Text>
            </Box>
          </Button>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
