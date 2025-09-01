import { ActionIcon, Group, Text, Tooltip } from "@mantine/core";
import { IconThumbDown, IconThumbUp } from "@tabler/icons-react";
import { trpc } from "@/koala/trpc-config";
import { useState } from "react";

type Props = {
  resultId: number;
  onClick?: () => void;
};

export function FeedbackVote({ resultId, onClick }: Props) {
  const mutation = trpc.editQuizResult.useMutation();
  const [selected, setSelected] = useState<1 | -1 | null>(null);

  const vote = (value: 1 | -1) => {
    if (selected !== null) {
      return;
    } // one-off
    setSelected(value);
    // Trigger optional callback immediately so parent can continue UI flow
    onClick?.();
    // Persist vote in background; ignore resolution here
    void mutation.mutateAsync({
      resultId,
      data: { helpfulness: value },
    });
  };

  return (
    <Group gap="xs" justify="center">
      <Text size="sm" c="dimmed">
        Was this helpful?
      </Text>
      <Tooltip label="Yes" openDelay={200}>
        <ActionIcon
          variant={selected === 1 ? "filled" : "default"}
          color="green"
          onClick={() => vote(1)}
          disabled={mutation.isLoading || selected !== null}
          aria-label="Thumbs up"
        >
          <IconThumbUp size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="No" openDelay={200}>
        <ActionIcon
          variant={selected === -1 ? "filled" : "default"}
          color="red"
          onClick={() => vote(-1)}
          disabled={mutation.isLoading || selected !== null}
          aria-label="Thumbs down"
        >
          <IconThumbDown size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
