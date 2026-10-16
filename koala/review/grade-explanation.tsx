import { type ReactNode, useState } from "react";
import { ActionIcon, Button, Group, Stack, Text } from "@mantine/core";
import { IconThumbDown, IconThumbUp } from "@tabler/icons-react";
import { trpc } from "../trpc-config";

export function GradeExplanation({ resultId }: { resultId: number }) {
  const explanation = trpc.explainQuizResult.useMutation();
  return (
    <GradeExplanationContent
      explanation={explanation.data?.explanation}
      isPending={explanation.isPending}
      error={explanation.isError ? explanation.error.message : undefined}
      onExplain={() => explanation.mutate({ resultId })}
    >
      <FeedbackVote resultId={resultId} />
    </GradeExplanationContent>
  );
}

export function GradeExplanationContent({
  explanation,
  isPending,
  error,
  onExplain,
  children,
}: {
  explanation?: string;
  isPending?: boolean;
  error?: string;
  onExplain: () => void;
  children: ReactNode;
}) {
  return (
    <>
      {explanation ? (
        <Stack
          gap="sm"
          pl="md"
          miw={0}
          style={{
            gridColumn: "1 / -1",
            borderLeft: "2px solid var(--mantine-color-pastel-2)",
          }}
        >
          <Text
            size="sm"
            lh={1.7}
            role="status"
            style={{ overflowWrap: "anywhere" }}
          >
            {explanation}
          </Text>
          {children}
        </Stack>
      ) : (
        <Button
          variant="outline"
          color="pink.8"
          size="sm"
          h={44}
          px="sm"
          style={{ gridColumn: 2, gridRow: 1, alignSelf: "center" }}
          loading={isPending}
          aria-busy={isPending}
          onClick={onExplain}
        >
          {error ? "Retry explanation" : "Explain"}
        </Button>
      )}
      {error && (
        <Text
          c="red.8"
          size="sm"
          role="alert"
          style={{ gridColumn: "1 / -1", overflowWrap: "anywhere" }}
        >
          {error}
        </Text>
      )}
    </>
  );
}

function FeedbackVote({ resultId }: { resultId: number }) {
  const mutation = trpc.editQuizResult.useMutation();
  const [selected, setSelected] = useState<1 | -1 | null>(null);
  return (
    <FeedbackVoteControls
      selected={selected}
      isPending={mutation.isPending}
      hasError={mutation.isError}
      onVote={(value) => {
        if (selected !== null || mutation.isPending) {
          return;
        }
        mutation.mutate(
          { resultId, data: { helpfulness: value } },
          { onSuccess: () => setSelected(value) },
        );
      }}
    />
  );
}

export function FeedbackVoteControls({
  selected,
  isPending,
  hasError,
  onVote,
}: {
  selected: 1 | -1 | null;
  isPending?: boolean;
  hasError?: boolean;
  onVote: (value: 1 | -1) => void;
}) {
  const isLocked = selected !== null || isPending;
  return (
    <Stack gap={4}>
      <Group gap="xs" aria-busy={isPending}>
        <Text size="xs" c="pastel.6" role="status">
          {selected === null ? "Was this helpful?" : "Feedback saved"}
        </Text>
        {[1, -1].map((value) => {
          const vote = value as 1 | -1;
          const Icon = vote === 1 ? IconThumbUp : IconThumbDown;
          return (
            <ActionIcon
              key={vote}
              variant={selected === vote ? "light" : "subtle"}
              color={selected === vote ? "pink.8" : "gray.7"}
              c={selected === vote ? "pink.8" : "pastel.6"}
              size={44}
              onClick={() => onVote(vote)}
              disabled={isLocked}
              aria-label={
                vote === 1
                  ? "Explanation was helpful"
                  : "Explanation was not helpful"
              }
              aria-pressed={selected === vote}
            >
              <Icon size={18} />
            </ActionIcon>
          );
        })}
      </Group>
      {hasError && (
        <Text size="xs" c="red.8" role="alert">
          Couldn't save your feedback. Try again.
        </Text>
      )}
    </Stack>
  );
}
