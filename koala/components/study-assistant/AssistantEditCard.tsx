import React from "react";
import {
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { AssistantEditProposal } from "./types";

type AssistantEditCardProps = {
  proposal: AssistantEditProposal;
  onSave: (updates: { term: string; definition: string }) => void;
  onDismiss: () => void;
  isSaving: boolean;
};

export default function AssistantEditCard({
  proposal,
  onSave,
  onDismiss,
  isSaving,
}: AssistantEditCardProps) {
  const [term, setTerm] = React.useState(proposal.term);
  const [definition, setDefinition] = React.useState(proposal.definition);

  React.useEffect(() => {
    setTerm(proposal.term);
    setDefinition(proposal.definition);
  }, [proposal.definition, proposal.term]);

  const canSave = term.trim() !== "" && definition.trim() !== "";
  const showOriginalTerm = hasDifferentValue(
    proposal.originalTerm,
    proposal.term,
  );
  const showOriginalDefinition = hasDifferentValue(
    proposal.originalDefinition,
    proposal.definition,
  );

  return (
    <Paper withBorder radius="md" p="sm" shadow="xs">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2} align="flex-start">
            <Text fz="sm" fw={700}>
              Edit card
            </Text>
            <Text size="xs" c="dimmed">
              Card #{proposal.cardId}
            </Text>
          </Stack>
          {proposal.note && (
            <Badge color="indigo" variant="light">
              {proposal.note}
            </Badge>
          )}
        </Group>

        {showOriginalTerm && (
          <OriginalValue
            label="Current term"
            value={proposal.originalTerm}
          />
        )}
        <TextInput
          label="Term"
          value={term}
          onChange={(event) => setTerm(event.currentTarget.value)}
        />

        {showOriginalDefinition && (
          <OriginalValue
            label="Current definition"
            value={proposal.originalDefinition}
          />
        )}
        <Textarea
          label="Definition"
          minRows={2}
          autosize
          value={definition}
          onChange={(event) => setDefinition(event.currentTarget.value)}
        />

        <Group justify="flex-end">
          <Button
            variant="subtle"
            color="gray"
            onClick={onDismiss}
            disabled={isSaving}
          >
            Dismiss
          </Button>
          <Button
            onClick={() => onSave({ term, definition })}
            disabled={!canSave || isSaving}
            loading={isSaving}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

function OriginalValue(props: {
  label: string;
  value: string | undefined;
}) {
  const { label, value } = props;
  if (!value) {
    return null;
  }
  return (
    <Text size="xs" c="dimmed">
      {label}: {value}
    </Text>
  );
}

function hasDifferentValue(original: string | undefined, current: string) {
  if (!original) {
    return false;
  }
  return original !== current;
}
