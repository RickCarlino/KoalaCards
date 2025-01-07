import { Text } from "@mantine/core";
import { VisualDiff } from "./visual-diff";

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
    return <Text>Feedback: {expected}</Text>;
  }
};
