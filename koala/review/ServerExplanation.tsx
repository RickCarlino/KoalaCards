import { Text, Box } from "@mantine/core";
import { VisualDiff } from "./visual-diff";
import { strip } from "../quiz-evaluators/evaluator-utils";

const PENCIL_EMOJI = "✏️";

export const ServerExplanation = ({
  expected,
  actual,
  heading,
}: {
  expected: string;
  actual: string;
  heading?: string;
}) => {
  // HACK: Stringly typed server response for now
  // Will re-do schema if I like the results.
  // This is an experiment.
  // - RC 16 NOV 2024
  if (expected.includes(PENCIL_EMOJI)) {
    return (
      <VisualDiff
        expected={expected.slice(1)}
        actual={actual}
        heading={typeof heading === "string" ? heading : "Feedback: "}
      />
    );
  } else {
    if (strip(expected).includes(strip(actual))) {
      return <Text size="md">Feedback: {expected}</Text>;
    } else {
      return (
        <Box>
          <Text size="md" fw={500} mb="xs">
            Feedback:
          </Text>
          <Text size="md">{expected}</Text>
          <Text size="md" mt="xs" fs="italic">
            You said: "{actual}"
          </Text>
        </Box>
      );
    }
  }
};
