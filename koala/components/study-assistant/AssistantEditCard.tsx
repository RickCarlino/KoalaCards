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

  const hasOriginalTerm =
    proposal.originalTerm && proposal.originalTerm !== proposal.term;
  const hasOriginalDefinition =
    proposal.originalDefinition &&
    proposal.originalDefinition !== proposal.definition;
  const canSave = term.trim() !== "" && definition.trim() !== "";

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

        {hasOriginalTerm && (
          <Text size="xs" c="dimmed">
            Current term: {proposal.originalTerm}
          </Text>
        )}
        <TextInput
          label="Term"
          value={term}
          onChange={(event) => setTerm(event.currentTarget.value)}
        />

        {hasOriginalDefinition && (
          <Text size="xs" c="dimmed">
            Current definition: {proposal.originalDefinition}
          </Text>
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
