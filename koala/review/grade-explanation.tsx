import { Button, Stack, Text } from "@mantine/core";
import { trpc } from "../trpc-config";

export function GradeExplanation({ resultId }: { resultId: number }) {
  const explanation = trpc.explainQuizResult.useMutation();
  return (
    <Stack gap="xs" align="center" maw={520}>
      {explanation.data ? (
        <Text ta="center" size="sm" role="status">
          {explanation.data.explanation}
        </Text>
      ) : (
        <Button
          variant="subtle"
          size="sm"
          loading={explanation.isPending}
          onClick={() => explanation.mutate({ resultId })}
        >
          {explanation.isError ? "Retry explanation" : "Explain"}
        </Button>
      )}
      {explanation.isError && (
        <Text c="red" size="sm" ta="center" role="alert">
          {explanation.error.message}
        </Text>
      )}
    </Stack>
  );
}
